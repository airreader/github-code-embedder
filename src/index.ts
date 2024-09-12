(()=> {
  const re = /(\[?https:\/\/github\.com\/([^/]*?)\/([^/]*?)\/blob\/([^/]*?)\/([^#]*?)(#[^:]+?)?:embed(?::lang=([^\]:]*))?(?::h([0-9]*))?\]?)/;
  document.addEventListener("DOMContentLoaded", async() => {
    const body = document.querySelector("body");
    if(!body) {
      return;
    }
    const parser = new DOMParser();
    const doc = parser.parseFromString(body.innerHTML, 'text/html');
    const walker = document.createTreeWalker(
      doc.body,
      NodeFilter.SHOW_TEXT,
      { 
        acceptNode(node) {
          return re.test(node.nodeValue ?? '') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
        }
      }
    )

    const targetNodes = []
    while (walker.nextNode()) {
      const textNode = walker.currentNode;
      if(!textNode.nodeValue) {
        return;
      }
      if (re.test(textNode.nodeValue)) {
        targetNodes.push(textNode)
      }
    }

    for(const targetNode of targetNodes) {
      if(!targetNode.nodeValue) { continue }
      const parentElement = targetNode.parentElement;
      if(!parentElement || parentElement.closest('pre')) { continue };
      const match = targetNode.nodeValue.match(re);
      if(!match) { continue };
      const iframe = await fetchIframe(match)
      
      if(parentElement.nodeName === 'a') {
        iframe ? parentElement.replaceWith(iframe) : '';
        continue;
      }
      parentElement.removeChild(targetNode);
      iframe ? parentElement.appendChild(iframe) : '';
    }
    body.innerHTML = doc.body.innerHTML
  })

  async function fetchIframe(match: RegExpMatchArray) {
    const body = document.querySelector("body")
    if(!body) {
      return;
    }
    const url = match[1].replace(/^\[(.*):embed/, "$1");
    const owner = match[2];
    const repo = match[3];
    const ref = match[4];
    const path = match[5];
    const anker = match[6];
    const lang = match[7];
    const height = Number(match[8])
    const lineMatches = anker ? anker.match(/#L([0-9]+)(?:-L([0-9]*))?/) ?? false : false;
    const lineStart = lineMatches ? Number(lineMatches[1]) : false;
    const lineEnd = lineMatches ? Number(lineMatches[2]) : false;
    //const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${ref}`
    const apiUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${path}`

    const response = await fetch(apiUrl);
    if (!response.ok) {
      const message = response.status === 403 ? 'Forbidden' : response.status === 404 ? 'Not Found' : 'Error';
      const iframe = getIframe({
        width: "300px",
        height: "150px",
        srcdocHTML: `<div>${message}</div><div><a href="${url}">${url}</a></div>`,
        border: "1px solid #dedede",
        borderRadius: "3px"
      })
      return iframe
    }

    // const json = await response.json();
    // const decodedUtf8str = atob(json.content);
    // const NumberIterable = Array.prototype.map.call(decodedUtf8str, c => c.charCodeAt()) as Iterable<number>;
    // const decodedArray: AllowSharedBufferSource = new Uint8Array(NumberIterable);
    // const decoded = new TextDecoder().decode(decodedArray);
    //const lines = decoded.split("\n");
    const text = await response.text()
    const lines = text.split("\n")
    const targetContent = lines.filter((value, index) => {
      if(!anker) { return true }
      if(lineStart && !lineEnd) { return index + 1 == lineStart }
      if(lineStart && lineEnd) { return index + 1 >= lineStart && index + 1 <= lineEnd }
    }).join("\n");

    const preElement = document.createElement("pre");
    const codeElement = document.createElement("code");
    codeElement.classList.add(`language-${lang}`)
    codeElement.textContent = targetContent;
    preElement.appendChild(codeElement)

    const displayLines = 
      !lineMatches ? lines.length
      : lineStart && lineEnd ? lineEnd - lineStart + 1
      : 1;
    const headerHeight = 46
    const lineHeight = 18
    const iframeMaxHeight = height ?? 500

    const html = getEmbedHTML({
      iframeMaxHeight, headerHeight, lineHeight, displayLines, url, owner, repo, ref,
      path, anker, lang, lineMatches, lineStart, lineEnd,
      preHTML: preElement.outerHTML
    })

    return getIframe({
      srcdocHTML: html,
      height: `${(lineHeight)*displayLines+headerHeight+4}px`,
      maxHeight: `${iframeMaxHeight}px`
    })
  }
  function getIframe(props: {
    srcdocHTML: string,
    height: string,
    maxHeight?: string,
    width?: string,
    border?: string,
    borderRadius?: string
  }) {
    const iframe = document.createElement('iframe');
    iframe.srcdoc = props.srcdocHTML;
    iframe.style.border = "none";
    iframe.style.width = props.width ?? "100%";
    iframe.style.height = props.height;
    iframe.style.maxHeight = props.maxHeight ?? "500px";
    iframe.style.border = props.border ?? "none";
    iframe.style.borderRadius = props.borderRadius ?? "0px";
    return iframe
  }

  function getEmbedHTML(props: {
    iframeMaxHeight: number,
    headerHeight: number, 
    lineHeight: number,
    displayLines: number,
    url: string,
    owner: string,
    repo: string,
    ref: string,
    path: string,
    anker: string,
    lang: string,
    lineMatches: RegExpMatchArray | false,
    lineStart: number | false,
    lineEnd: number | false,
    preHTML: string
  }) {
    return `
    <head>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism.min.css" integrity="sha512-tN7Ec6zAFaVSG3TpNAKtk4DOHNpSwKHxxrsiw4GHKESGPs5njn/0sMCUMl2svV4wo4BK/rCP7juYz+zx+l6oeQ==" crossorigin="anonymous" referrerpolicy="no-referrer" />
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/plugins/line-numbers/prism-line-numbers.min.css" integrity="sha512-cbQXwDFK7lj2Fqfkuxbo5iD1dSbLlJGXGpfTDqbggqjHJeyzx88I3rfwjS38WJag/ihH7lzuGlGHpDBymLirZQ==" crossorigin="anonymous" referrerpolicy="no-referrer" />
      <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js" integrity="sha512-7Z9J3l1+EYfeaPKcGXu3MS/7T+w19WtKQY/n+xzmw4hZhJ9tyYmcUS+4QqAlzhicE5LAfMQSF3iFTK9bQdTxXg==" crossorigin="anonymous" referrerpolicy="no-referrer"><\/script>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/plugins/autoloader/prism-autoloader.min.js" integrity="sha512-SkmBfuA2hqjzEVpmnMt/LINrjop3GKWqsuLSSB3e7iBmYK7JuWw4ldmmxwD9mdm2IRTTi0OxSAfEGvgEi0i2Kw==" crossorigin="anonymous" referrerpolicy="no-referrer"><\/script>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/plugins/line-numbers/prism-line-numbers.min.js" integrity="sha512-BttltKXFyWnGZQcRWj6osIg7lbizJchuAMotOkdLxHxwt/Hyo+cl47bZU0QADg+Qt5DJwni3SbYGXeGMB5cBcw==" crossorigin="anonymous" referrerpolicy="no-referrer"><\/script>
      <script>Prism.highlightAll()<\/script>
    </head>
    <body>
    <style>
      * {
        margin: 0px;
        padding: 0px;
      }
      .header {
        display: flex;
        flex-direction: row;
        font-size: 12px;
        background-color: #f6f8fa;
        padding: 6px 12px;
        border: 1px solid #dedede;
        border-bottom: none;
        border-radius: 3px 3px 0 0;
        height: ${props.headerHeight}px;
        box-sizing: border-box;
        font-family: BlinkMacSystemFont, sans-serif;
        gap: 6px;
        align-items: center;
      }
    
      .meta {
        display: flex;
        flex-direction: row;
        gap: 6px;
        color: #59636e;
        line-height: 1.15rem;
      }
      .github-icon {
        background-image: url('data:image/svg+xml;charset=utf8,%3Csvg%20width%3D%2298%22%20height%3D%2296%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cpath%20fill-rule%3D%22evenodd%22%20clip-rule%3D%22evenodd%22%20d%3D%22M48.854%200C21.839%200%200%2022%200%2049.217c0%2021.756%2013.993%2040.172%2033.405%2046.69%202.427.49%203.316-1.059%203.316-2.362%200-1.141-.08-5.052-.08-9.127-13.59%202.934-16.42-5.867-16.42-5.867-2.184-5.704-5.42-7.17-5.42-7.17-4.448-3.015.324-3.015.324-3.015%204.934.326%207.523%205.052%207.523%205.052%204.367%207.496%2011.404%205.378%2014.235%204.074.404-3.178%201.699-5.378%203.074-6.6-10.839-1.141-22.243-5.378-22.243-24.283%200-5.378%201.94-9.778%205.014-13.2-.485-1.222-2.184-6.275.486-13.038%200%200%204.125-1.304%2013.426%205.052a46.97%2046.97%200%200%201%2012.214-1.63c4.125%200%208.33.571%2012.213%201.63%209.302-6.356%2013.427-5.052%2013.427-5.052%202.67%206.763.97%2011.816.485%2013.038%203.155%203.422%205.015%207.822%205.015%2013.2%200%2018.905-11.404%2023.06-22.324%2024.283%201.78%201.548%203.316%204.481%203.316%209.126%200%206.6-.08%2011.897-.08%2013.526%200%201.304.89%202.853%203.316%202.364%2019.412-6.52%2033.405-24.935%2033.405-46.691C97.707%2022%2075.788%200%2048.854%200z%22%20fill%3D%22%2324292f%22%2F%3E%3C%2Fsvg%3E');
        background-size: contain;
        width: 24px;
        height: 24px;
      }
      .sha {
        text-decoration: underline;
        text-underline-offset: .2rem;
        font-family: monospace;
      }
      .sha a {
        color: #1f2328;
      }
      .size {
        margin-right: 3px;
      }
      .lang {
        text-transform: uppercase;
        font-weight: bold;
      }
      .file-link {
        color: #0969da;
        font-weight: bold;
        text-underline-offset: .2rem;
      }
      .line-num {
        user-select: none;
        text-align: right;
        color: #808080;
        padding-left: 12px;
      }
      .line-body {
        white-space: pre;
        padding-left: 12px;
      }
      .body {
        overflow: auto;
        height: ${(props.lineHeight) * props.displayLines + 4}px;
        max-height: ${props.iframeMaxHeight - props.headerHeight - 2}px;
        border: 1px solid #dedede;
        box-sizing: border-box;
        border-radius: 0px 0px 3px 3px;
      }
      pre[class*=language-] {
        font-size: 12px;
        font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
        background-color: #fff;
        padding: 0;
        margin: 0;
      }
      pre[class*=language-].line-numbers {
        counter-reset: linenumber ${props.lineStart ? props.lineStart - 1 : ''};
        overflow: hidden;
      }
      code[class*=language-], pre[class*=language-] {
        line-height: ${props.lineHeight}px;
      }
      .line-numbers .line-numbers-rows {
        border-right: 1px solid #e0e0e0;
      }
    </style>
    <div class="main">
      <div class="header">
        <div class="github-icon"></div>
        <div>
          <div><a class="file-link" href="${props.url}">${props.owner}/${props.repo}/${props.path}</a></div>
          <div class="meta">
            <div><span class="lang">${props.lang}</span></div>
            ${props.lineStart ? `<div>Line ${props.lineStart} ${props.lineEnd ? `to ${props.lineEnd}` : ''}</div>` : ''} 
            <div class="sha"><a href="https://github.com/${props.owner}/${props.repo}/commit/${props.ref}">${props.ref.substring(0,7)}</a></div>
          </div>
        </div>
      </div>
      <div class="body line-numbers">
        ${props.preHTML}
      </div>
    </div>
    </body>
    `
  }
  
})();
