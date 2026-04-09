import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { action, data } = await req.json();

    switch (action) {
      // Site içi etkileşim kaydet
      case 'log_interaction': {
        const { user_id, interaction_type, page_path, action_data, context } = data;
        const { error } = await supabase.from('ai_user_interactions').insert({
          user_id,
          interaction_type,
          page_path,
          action_data,
          context,
          session_id: data.session_id || crypto.randomUUID()
        });
        if (error) throw error;
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Arama sorgusu kaydet
      case 'log_search': {
        const { user_id, query_text, search_context, results_count } = data;
        const { error } = await supabase.from('ai_search_queries').insert({
          user_id,
          query_text,
          search_context,
          results_count,
          is_successful: results_count > 0
        });
        if (error) throw error;
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Bilgi tabanına ekle
      case 'add_knowledge': {
        const { category, subcategory, title, content, source_type, source_url, metadata } = data;
        const { error } = await supabase.from('ai_knowledge_base').insert({
          category,
          subcategory,
          title,
          content,
          source_type,
          source_url,
          metadata,
          reliability_score: source_type === 'internal' ? 0.9 : 0.7
        });
        if (error) throw error;
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Soru-cevap çifti kaydet (öğrenme için)
      case 'log_qa': {
        const { question, answer, answer_sources, sector_context } = data;
        const { error } = await supabase.from('ai_qa_learning').insert({
          question,
          answer,
          answer_sources,
          sector_context,
          question_intent: detectIntent(question)
        });
        if (error) throw error;
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Kullanıcı feedback kaydet
      case 'log_feedback': {
        const { qa_id, score, comment } = data;
        const { error } = await supabase.from('ai_qa_learning')
          .update({ 
            user_feedback_score: score,
            expert_verified: score >= 4
          })
          .eq('id', qa_id);
        if (error) throw error;
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Günlük özet oluştur
      case 'generate_daily_summary': {
        const today = new Date().toISOString().split('T')[0];
        
        // Bugünkü istatistikleri topla
        const { data: interactions } = await supabase
          .from('ai_user_interactions')
          .select('interaction_type')
          .gte('created_at', today);
        
        const { data: searches } = await supabase
          .from('ai_search_queries')
          .select('query_text')
          .gte('created_at', today);
        
        // En çok aranan terimler
        const searchTerms = searches?.map(s => s.query_text) || [];
        const termCounts: Record<string, number> = {};
        searchTerms.forEach(term => {
          termCounts[term] = (termCounts[term] || 0) + 1;
        });
        const topTerms = Object.entries(termCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([term, count]) => ({ term, count }));

        const { error } = await supabase.from('ai_daily_summary').upsert({
          summary_date: today,
          total_interactions: interactions?.length || 0,
          total_searches: searches?.length || 0,
          top_search_terms: topTerms,
          insights: {
            generated_at: new Date().toISOString(),
            unique_users: new Set(interactions?.map(i => i.user_id)).size
          }
        }, { onConflict: 'summary_date' });
        
        if (error) throw error;
        return new Response(JSON.stringify({ success: true, summary_date: today }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Öğrenme durumu
      case 'get_learning_stats': {
        const { data: knowledge } = await supabase
          .from('ai_knowledge_base')
          .select('category', { count: 'exact' });
        
        const { data: qaCount } = await supabase
          .from('ai_qa_learning')
          .select('id', { count: 'exact' });
        
        const { data: patterns } = await supabase
          .from('ai_learned_patterns')
          .select('id', { count: 'exact' });

        return new Response(JSON.stringify({
          knowledge_items: knowledge?.length || 0,
          qa_pairs: qaCount?.length || 0,
          patterns_learned: patterns?.length || 0,
          status: 'learning_mode'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      default:
        return new Response(JSON.stringify({ error: 'Unknown action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

// Soru intent'ini tespit et
function detectIntent(question: string): string {
  const q = question.toLowerCase();
  if (q.includes('madde') || q.includes('kanun') || q.includes('yönetmelik')) return 'mevzuat_soru';
  if (q.includes('risk') || q.includes('tehlike') || q.includes('değerlendirme')) return 'risk_analiz';
  if (q.includes('kkd') || q.includes('koruyucu') || q.includes('donanım')) return 'kkd_secim';
  if (q.includes('eğitim') || q.includes('sertifika')) return 'egitim';
  if (q.includes('kaza') || q.includes('yaralanma')) return 'kaza_analiz';
  return 'genel';
}