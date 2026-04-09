import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function getMevzuatHtmlUrl(docType: string, mevzuatNo: string): string {
  if (docType === 'regulation') {
    return `https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=${mevzuatNo}&MevzuatTur=7&MevzuatTertip=5`;
  }
  return `https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=${mevzuatNo}&MevzuatTur=1&MevzuatTertip=5`;
}

function parseArticlesFromHtml(html: string, docTitle: string): Array<{
  article_number: string;
  article_title: string;
  content: string;
  article_type: string;
  is_repealed: boolean;
}> {
  const articles: Array<{
    article_number: string;
    article_title: string;
    content: string;
    article_type: string;
    is_repealed: boolean;
  }> = [];
  
  let cleanText = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  
  const patterns = [
    { regex: /GE\u00c7\u0130C\u0130\s+MADDE\s+(\d+)\s*[-\u2013\u2014]?\s*([\s\S]*?)(?=GE\u00c7\u0130C\u0130\s+MADDE\s+\d|(?:^|\n)MADDE\s+\d|EK\s+MADDE\s+\d|$)/gim, type: 'gecici', prefix: 'Ge\u00e7ici Madde' },
    { regex: /EK\s+MADDE\s+(\d+)\s*[-\u2013\u2014]?\s*([\s\S]*?)(?=GE\u00c7\u0130C\u0130\s+MADDE\s+\d|(?:^|\n)MADDE\s+\d|EK\s+MADDE\s+\d|$)/gim, type: 'ek', prefix: 'Ek Madde' },
    { regex: /(?:^|\n)MADDE\s+(\d+(?:\/[A-Z\u011e\u00dc\u015e\u0130\u00d6\u00c7])?)\s*[-\u2013\u2014]?\s*([\s\S]*?)(?=GE\u00c7\u0130C\u0130\s+MADDE\s+\d|(?:^|\n)MADDE\s+\d|EK\s+MADDE\s+\d|$)/gim, type: 'normal', prefix: 'Madde' },
  ];
  
  const foundArticles = new Map<string, boolean>();
  
  for (const pattern of patterns) {
    let match;
    const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
    while ((match = regex.exec(cleanText)) !== null) {
      const articleNum = match[1].trim();
      let content = match[2].trim();
      if (content.length < 20) continue;
      if (content.length > 10000) content = content.substring(0, 10000) + '...';
      const articleKey = `${pattern.type}-${articleNum}`;
      if (foundArticles.has(articleKey)) continue;
      foundArticles.set(articleKey, true);
      const articleNumber = `${pattern.prefix} ${articleNum}`;
      let actualType = pattern.type;
      if (articleNum.includes('/')) actualType = 'mukerrer';
      const isRepealed = /\(M\u00fclga\)|m\u00fclga edilmi\u015ftir/i.test(content);
      articles.push({ article_number: articleNumber, article_title: articleNumber, content, article_type: actualType, is_repealed: isRepealed });
    }
  }
  
  if (articles.length === 0 && cleanText.length > 200) {
    articles.push({ article_number: 'Giris', article_title: docTitle, content: cleanText.substring(0, 10000), article_type: 'normal', is_repealed: false });
  }
  
  return articles;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const body = await req.json();
    const { action, document_id } = body;
    
    console.log('Action:', action, 'DocId:', document_id);
    
    if (action === 'list') {
      // Use RPC for efficient single-query with chunk counts
      const { data, error } = await supabase.rpc('get_legal_docs_with_counts');
      
      if (error) {
        console.error('RPC error:', error.message);
        // Fallback: simple query without counts
        const { data: docs, error: docsErr } = await supabase
          .from('legal_documents')
          .select('id, title, doc_type, doc_number, source_url, last_synced_at')
          .order('title');
        
        if (docsErr) {
          console.error('Fallback error:', docsErr.message);
          return jsonResp({ error: docsErr.message }, 500);
        }
        return jsonResp((docs || []).map(d => ({ ...d, chunk_count: 0 })));
      }
      
      return jsonResp(data || []);
      
    } else if (action === 'sync_single' && document_id) {
      const { data: doc, error: docError } = await supabase
        .from('legal_documents')
        .select('*')
        .eq('id', document_id)
        .single();
      
      if (docError || !doc) {
        console.error('Doc not found:', docError?.message);
        return jsonResp({ error: 'Mevzuat bulunamadi' }, 404);
      }
      
      let mevzuatNo = doc.doc_number;
      if (doc.source_url) {
        const match = doc.source_url.match(/mevzuatNo=(\d+)/i);
        if (match) mevzuatNo = match[1];
      }
      
      const htmlUrl = getMevzuatHtmlUrl(doc.doc_type, mevzuatNo);
      console.log('Fetching:', htmlUrl);
      
      const response = await fetch(htmlUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html',
          'Accept-Language': 'tr-TR,tr;q=0.9',
        },
      });
      
      if (!response.ok) return jsonResp({ error: `HTTP ${response.status}`, url: htmlUrl }, 502);
      
      const htmlContent = await response.text();
      if (htmlContent.length < 500) return jsonResp({ error: 'Icerik cok kisa', length: htmlContent.length }, 400);
      
      const articles = parseArticlesFromHtml(htmlContent, doc.title);
      if (articles.length === 0) return jsonResp({ error: 'Madde bulunamadi', htmlLength: htmlContent.length }, 400);
      
      await supabase.from('legal_chunks').delete().eq('document_id', document_id);
      
      const chunks = articles.map((article, index) => ({
        document_id, chunk_index: index,
        article_number: article.article_number, article_title: article.article_title,
        content: article.content, article_type: article.article_type,
        is_repealed: article.is_repealed, content_tokens: Math.ceil(article.content.length / 4),
      }));
      
      const { error: insertError } = await supabase.from('legal_chunks').insert(chunks);
      if (insertError) {
        console.error('Insert error:', insertError.message);
        return jsonResp({ error: 'Chunk ekleme hatasi', details: insertError.message }, 500);
      }
      
      await supabase.from('legal_documents').update({ last_synced_at: new Date().toISOString() }).eq('id', document_id);
      
      return jsonResp({
        success: true, document: doc.title, articles_added: articles.length,
        article_types: {
          normal: articles.filter(a => a.article_type === 'normal').length,
          gecici: articles.filter(a => a.article_type === 'gecici').length,
          ek: articles.filter(a => a.article_type === 'ek').length,
          mukerrer: articles.filter(a => a.article_type === 'mukerrer').length,
          mulga: articles.filter(a => a.is_repealed).length,
        }
      });
      
    } else if (action === 'test') {
      return jsonResp({ status: 'ok', timestamp: new Date().toISOString(), message: 'Edge Function calisiyor!' });
    } else {
      return jsonResp({ error: 'Gecersiz action', valid_actions: ['sync_single', 'list', 'test'] }, 400);
    }
  } catch (error) {
    console.error('Caught error:', error.message, error.stack);
    return jsonResp({ error: error.message }, 500);
  }
});

function jsonResp(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
