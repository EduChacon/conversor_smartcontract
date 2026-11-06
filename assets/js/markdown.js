/*
 * Renderizador mínimo e seguro de Markdown para as respostas da IA.
 * Todo o texto é escapado ANTES da formatação; nenhum HTML vindo da IA é
 * interpretado, o que impede injeção de scripts (XSS).
 */
(function () {
    'use strict';
    const CSC = (window.CSC = window.CSC || {});

    function escapeHtml(s) {
        return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function inline(s) {
        // "s" já está escapado.
        return s
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
            .replace(/(^|[^*\w])\*([^*\n]+)\*(?=[^*\w]|$)/g, '$1<em>$2</em>');
    }

    function render(markdown) {
        const lines = String(markdown || '').replace(/\r\n?/g, '\n').split('\n');
        const html = [];
        let list = null; // 'ul' | 'ol'
        let para = [];

        const flushPara = () => {
            if (para.length) {
                html.push('<p>' + inline(escapeHtml(para.join(' '))) + '</p>');
                para = [];
            }
        };
        const closeList = () => {
            if (list) {
                html.push('</' + list + '>');
                list = null;
            }
        };

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const fence = /^\s*```(\w*)\s*$/.exec(line);
            if (fence) {
                flushPara();
                closeList();
                const code = [];
                i++;
                while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) code.push(lines[i++]);
                html.push('<pre class="md-code"><code>' + escapeHtml(code.join('\n')) + '</code></pre>');
                continue;
            }
            const heading = /^\s*(#{1,6})\s+(.*)$/.exec(line);
            if (heading) {
                flushPara();
                closeList();
                const level = Math.min(heading[1].length + 3, 6);
                html.push(`<h${level}>` + inline(escapeHtml(heading[2])) + `</h${level}>`);
                continue;
            }
            const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
            const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
            if (bullet || numbered) {
                flushPara();
                const type = bullet ? 'ul' : 'ol';
                if (list !== type) {
                    closeList();
                    html.push('<' + type + '>');
                    list = type;
                }
                html.push('<li>' + inline(escapeHtml((bullet || numbered)[1])) + '</li>');
                continue;
            }
            if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) {
                flushPara();
                closeList();
                html.push('<hr>');
                continue;
            }
            if (!line.trim()) {
                flushPara();
                closeList();
                continue;
            }
            if (list && /^\s{2,}\S/.test(line)) {
                // Continuação de item de lista.
                html[html.length - 1] = html[html.length - 1].replace(/<\/li>$/, ' ' + inline(escapeHtml(line.trim())) + '</li>');
                continue;
            }
            closeList();
            para.push(line.trim());
        }
        flushPara();
        closeList();
        return html.join('\n');
    }

    CSC.markdown = { render, escapeHtml };
})();
