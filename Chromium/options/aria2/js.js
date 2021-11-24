document.querySelector('#version').innerText = location.search.slice(1);

document.querySelector('#back_btn').addEventListener('click', event => {
    frameElement.remove();
});

document.addEventListener('change', event => {
    aria2RPCRequest({id: '', jsonrpc: 2, method: 'aria2.changeGlobalOption', params: [aria2RPC.jsonrpc['token'], {[event.target.getAttribute('aria2')]: event.target.value}]});
});

function aria2RPCClient() {
    printGlobalOption();
}
