document.querySelector('#version').innerText = location.search.slice(1);

document.querySelector('#back_btn').addEventListener('click', (event) => {
    frameElement.remove();
});

document.addEventListener('change', (event) => {
    changeGlobalOption(event.target.getAttribute('aria2'), event.target.value);
});

function aria2RPCClient() {
    printGlobalOption();
}
