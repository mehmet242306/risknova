import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// İSG ile ilgili kaynaklar
const ISG_SOURCES = [
  {
    name: 'Resmi Gazete - İş Sağlığı',
    url: 'https://www.resmigazete.gov.tr/default.aspx',
    type: 'mevzuat',
    category: 'resmi_gazete'
  },
  {
    name: 'ÇSGB Duyurular',
    url: 'https://www.csgb.gov.tr',
    type: 'duyuru',
    category: 'csgb'
  },
  {
    name: 'İSGGM',
    url: 'https://www.isggm.gov.tr',
    type: 'duyuru',
    category: 'isggm'
  }
];

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
      // Dış kaynak ekle
      case 'add_source': {
        const { source_name, source_type, source_url, category, check_frequency } = data;
        const { error } = await supabase.from('ai_external_sources').insert({
          source_name,
          source_type,
          source_url,
          category,
          check_frequency: check_frequency || '1 day'
        });
        if (error) throw error;
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Dış veri kaydet
      case 'save_external_data': {
        const { source_type, source_url, title, content, published_date, metadata } = data;
        
        // Aynı URL zaten var mı kontrol et
        const { data: existing } = await supabase
          .from('ai_external_data')
          .select('id')
          .eq('source_url', source_url)
          .single();
        
        if (existing) {
          return new Response(JSON.stringify({ success: true, status: 'already_exists' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const { error } = await supabase.from('ai_external_data').insert({
          source_type,
          source_url,
          title,
          content,
          published_date,
          metadata,
          is_processed: false
        });
        if (error) throw error;
        return new Response(JSON.stringify({ success: true, status: 'added' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // İşlenmemiş verileri işle ve bilgi tabanına ekle
      case 'process_external_data': {
        // İşlenmemiş verileri al
        const { data: unprocessed, error: fetchError } = await supabase
          .from('ai_external_data')
          .select('*')
          .eq('is_processed', false)
          .limit(10);
        
        if (fetchError) throw fetchError;
        
        let processedCount = 0;
        for (const item of unprocessed || []) {
          // İşle ve bilgi tabanına ekle
          const category = mapSourceToCategory(item.source_type);
          
          const { error: insertError } = await supabase.from('ai_knowledge_base').insert({
            category,
            title: item.title,
            content: item.content,
            source_type: 'external',
            source_url: item.source_url,
            reliability_score: 0.8,
            metadata: item.metadata
          });
          
          if (!insertError) {
            // İşlendi olarak işaretle
            await supabase
              .from('ai_external_data')
              .update({ is_processed: true })
              .eq('id', item.id);
            processedCount++;
          }
        }
        
        // Eğitim logunu güncelle
        await supabase.from('ai_training_logs').insert({
          training_type: 'data_processing',
          status: 'completed',
          data_count: processedCount,
          metrics: { processed: processedCount, total: unprocessed?.length || 0 },
          completed_at: new Date().toISOString()
        });
        
        return new Response(JSON.stringify({ 
          success: true, 
          processed: processedCount,
          total: unprocessed?.length || 0
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Öğrenme oturumu başlat
      case 'start_learning_session': {
        const { session_type } = data;
        
        const { data: session, error } = await supabase.from('ai_learning_sessions').insert({
          session_type,
          status: 'running',
          started_at: new Date().toISOString()
        }).select().single();
        
        if (error) throw error;
        return new Response(JSON.stringify({ success: true, session_id: session.id }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Öğrenme oturumunu tamamla
      case 'complete_learning_session': {
        const { session_id, data_processed, new_knowledge_added, patterns_discovered, metrics } = data;
        
        const { error } = await supabase.from('ai_learning_sessions')
          .update({
            status: 'completed',
            data_processed,
            new_knowledge_added,
            patterns_discovered,
            metrics,
            completed_at: new Date().toISOString()
          })
          .eq('id', session_id);
        
        if (error) throw error;
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Kaynakları listele
      case 'list_sources': {
        const { data: sources, error } = await supabase
          .from('ai_external_sources')
          .select('*')
          .eq('is_active', true);
        
        if (error) throw error;
        return new Response(JSON.stringify({ sources }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Öğrenme istatistikleri
      case 'get_stats': {
        const { count: knowledgeCount } = await supabase
          .from('ai_knowledge_base')
          .select('*', { count: 'exact', head: true });
        
        const { count: externalCount } = await supabase
          .from('ai_external_data')
          .select('*', { count: 'exact', head: true });
        
        const { count: unprocessedCount } = await supabase
          .from('ai_external_data')
          .select('*', { count: 'exact', head: true })
          .eq('is_processed', false);
        
        const { count: sessionsCount } = await supabase
          .from('ai_learning_sessions')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'completed');
        
        const { data: lastSession } = await supabase
          .from('ai_learning_sessions')
          .select('*')
          .eq('status', 'completed')
          .order('completed_at', { ascending: false })
          .limit(1)
          .single();

        return new Response(JSON.stringify({
          knowledge_base_size: knowledgeCount || 0,
          external_data_collected: externalCount || 0,
          pending_processing: unprocessedCount || 0,
          learning_sessions_completed: sessionsCount || 0,
          last_session: lastSession,
          mode: 'Öğrenme Modu (Pasif)'
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

function mapSourceToCategory(sourceType: string): string {
  const mapping: Record<string, string> = {
    'resmi_gazete': 'mevzuat',
    'csgb': 'duyuru',
    'isggm': 'duyuru',
    'news': 'haber',
    'manual': 'genel'
  };
  return mapping[sourceType] || 'genel';
}