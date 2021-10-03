var cards = document.querySelectorAll('[card]');
var cardCurrent = 0;
var cardNext = 0;
var cardLimit = cards.length - 1;
var wheelScroll = 0;

cards.forEach(card => {
    card.style.display = card === cards[cardCurrent] ? 'block' : 'none';
    card.addEventListener('wheel', (event) => {
        if (event.target.tagName === 'TEXTAREA') {
            return;
        }
        cardNext = event.deltaY > 0 && card.scrollHeight - card.scrollTop === card.clientHeight && cardCurrent !== cardLimit ?
            cardCurrent + 1 : event.deltaY < 0 && card.scrollTop === 0 && cardCurrent !== 0 ? cardCurrent - 1 : cardCurrent;
        switchCardView();
    }, {passive: true});
});

document.addEventListener('keydown', (event) => {
    if (event.target.tagName === 'TEXTAREA') {
        return;
    }
    cardNext = event.key === 'PageDown' && cardCurrent !== cardLimit ? cardCurrent + 1 :
        event.key === 'PageUp' && cardCurrent !== 0 ? cardCurrent - 1 : cardCurrent;
    switchCardView();
});

function switchCardView() {
    cards[cardCurrent].style.display = 'none';
    cards[cardNext].style.display = 'block';
    cardCurrent = cardNext;
    wheelScroll = 0;
}
