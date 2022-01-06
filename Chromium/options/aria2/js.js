document.querySelector('#version').innerText = location.search.slice(1);

document.querySelector('#back_btn').addEventListener('click', event => {
    history.back();
});

document.addEventListener('change', event => {
    aria2RPCCall({method: 'aria2.changeGlobalOption', params: [{[event.target.getAttribute('aria2')]: event.target.value}]});
});

function aria2RPCClient() {
    aria2RPCCall({method: 'aria2.getGlobalOption'},
    options => document.querySelectorAll('[aria2]').forEach(aria2 => parseValueToOption(aria2, 'aria2', options)));
}
