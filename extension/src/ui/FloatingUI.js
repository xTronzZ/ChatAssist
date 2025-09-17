// Simplified Floating UI script
(function() {
  const shadowHost = document.createElement('div');
  shadowHost.id = 'chatassist-root';
  document.body.appendChild(shadowHost);
  const shadow = shadowHost.attachShadow({ mode: 'open' });

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.bottom = '20px';
  container.style.right = '20px';
  container.style.width = '300px';
  container.style.height = '200px';
  container.style.background = 'white';
  container.style.border = '1px solid #ccc';
  container.style.borderRadius = '8px';
  container.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
  container.style.padding = '10px';
  container.style.zIndex = '999999';

  container.innerHTML = `
    <h3>ChatAssist</h3>
    <textarea id="intent" placeholder="Your intent..."></textarea>
    <textarea id="draft" placeholder="Your draft..."></textarea>
    <div id="suggestions"></div>
  `;

  shadow.appendChild(container);
})();