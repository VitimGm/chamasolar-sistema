/* =====================================================================
   Ícones Chama Solar — traço de 2px, cantos arredondados, cor pela classe.
   Uso: Icone('sol') → string <svg>. Animações em css/icones.css.
   Desenhados para o sistema (não são de terceiros).
   ===================================================================== */
(function (raiz) {
  'use strict';
  const P = {
    sol: '<g class="i-raios"><path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6"/></g><circle cx="12" cy="12" r="4.2" class="i-cheio"/>',
    painel: '<path d="M3.5 17.5 6 7h12l2.5 10.5z"/><path d="M4.7 12.3h14.6M9.3 7l-1 10.5M14.7 7l1 10.5"/><path d="M12 17.5v3M8.5 20.5h7"/>',
    inversor: '<rect x="5" y="3" width="14" height="18" rx="2.5"/><path class="i-pulso" d="M12.8 7.5 9.8 12.4h3l-1.6 4.1 3.6-5.3h-3z"/><path d="M8 18.5h8"/>',
    micro: '<rect x="3" y="7" width="7.5" height="10" rx="1.8"/><rect x="13.5" y="7" width="7.5" height="10" rx="1.8"/><path class="i-pulso" d="M7.4 9.8 6 12.3h1.6l-.8 2M17.9 9.8l-1.4 2.5h1.6l-.8 2"/>',
    bateria: '<rect x="3" y="7" width="16" height="10" rx="2.2"/><path d="M21 10.5v3"/><rect class="i-carga" x="5.2" y="9.2" width="7" height="5.6" rx="1" />',
    grafico: '<path d="M3.5 20.5h17"/><path d="M5 16.5l4-4.5 3.2 2.6 6.3-7.1"/><path d="M15.2 7.5h3.3v3.3"/>',
    ferramenta: '<path d="M14.6 6.3a4 4 0 0 0-5.3 5L4 16.6 7.4 20l5.3-5.3a4 4 0 0 0 5-5.3l-2.4 2.4-2.4-.6-.6-2.4z"/>',
    medalha: '<circle cx="12" cy="9.5" r="5.5"/><path d="M8.6 14l-1.6 7 5-2.6 5 2.6-1.6-7"/><path d="m12 7.2.8 1.6 1.8.3-1.3 1.2.3 1.8-1.6-.9-1.6.9.3-1.8-1.3-1.2 1.8-.3z" class="i-cheio"/>',
    estrela: '<path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z"/>',
    documento: '<path d="M14.5 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7.5z"/><path d="M14.5 3v4.5H19M8.5 12.5h7M8.5 16h5"/><path class="i-check" d="m9 9 1.2 1.2L12.5 8"/>',
    monitor: '<rect x="3" y="4" width="18" height="12.5" rx="2"/><path d="M8.5 20.5h7M12 16.5v4"/><path class="i-linha" d="M6.5 12.5l2.7-3 2.4 2 2.6-3.4 3.3 2.4"/>',
    casa: '<path d="M3.5 11 12 4l8.5 7"/><path d="M5.5 9.5V20h13V9.5"/><path d="M10 20v-5h4v5"/>',
    conta: '<path d="M6 3h12v18l-2.2-1.4L13.5 21l-1.5-1.4L10.5 21l-2.3-1.4L6 21z"/><path d="M9 8h6M9 11.5h6M9 15h3.5"/>',
    relogio: '<circle cx="12" cy="12.5" r="8"/><path class="i-ponteiro" d="M12 8.5v4l2.8 1.8"/><path d="M9.5 2.5h5"/>',
    cofre: '<path d="M4.5 10.5c0-3.6 3.4-6 7.5-6s7.5 2.4 7.5 6v3c0 2.3-1.4 4-3.3 5l.3 2H14l-.3-1.4a9 9 0 0 1-3.4 0L10 21H7.5l.3-2c-1.9-1-3.3-2.7-3.3-5z"/><path d="M9.5 9.5h5" /><circle class="i-moeda" cx="12" cy="3" r="1.6"/>',
    pessoas: '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 19.5c.4-3.3 2.6-5.3 5.5-5.3s5.1 2 5.5 5.3"/><circle cx="17" cy="9" r="2.5"/><path d="M15.8 14.4c2.5.1 4.2 1.9 4.6 4.6"/>',
    conversa: '<path d="M4 18.5V7a2.5 2.5 0 0 1 2.5-2.5h11A2.5 2.5 0 0 1 20 7v7a2.5 2.5 0 0 1-2.5 2.5H8z"/><path class="i-pontos" d="M8.5 10.8h.01M12 10.8h.01M15.5 10.8h.01" stroke-width="2.6"/>',
    som: '<path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z"/><path class="i-onda" d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
    letra: '<path d="M3.5 18 8 6l4.5 12M5.2 13.5h5.6"/><path d="M17.5 8.5v7M14 12h7"/>',
    sombra: '<path d="M3 17.5 5.2 9h11.6l2.2 8.5z"/><path d="M19 4.5a3.5 3.5 0 1 1-4 3.5"/>',
    seta: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    mais: '<path d="M12 5v14M5 12h14"/>',
    painelControle: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="13.5" y="3.5" width="7" height="4.5" rx="1.6"/><rect x="13.5" y="11" width="7" height="9.5" rx="1.6"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.6"/>',
    catalogo: '<path d="M4 6.5 12 3l8 3.5-8 3.5z"/><path d="M4 11.5l8 3.5 8-3.5M4 16.5l8 3.5 8-3.5"/>',
    agentes: '<path d="M12 3.5l1.9 4.8 4.8 1.9-4.8 1.9L12 16.9l-1.9-4.8L5.3 10.2l4.8-1.9z"/><path d="M18.5 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>',
    ajustes: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2.2"/><circle cx="9" cy="17" r="2.2"/>',
  };
  function Icone(nome, classe = '') {
    return `<svg class="ico ico-${nome} ${classe}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${P[nome] || ''}</svg>`;
  }
  raiz.Icone = Icone;
})(window);
