document.querySelectorAll('[tab]').forEach((tab, index) => {
    var name = tab.getAttribute('tab');
    if (index === 0) {
        tab.classList.add('checked');
        activeTab = name;
    }
    tab.addEventListener('click', (event) => {
        if (!tab.classList.contains('checked')) {
            document.querySelector('[tab="' + name + '"]').classList.add('checked');
            document.querySelector('[panel="' + name + '"]').style.display = 'block';
            document.querySelector('[tab="' + activeTab + '"]').classList.remove('checked');
            document.querySelector('[panel="' + activeTab + '"]').style.display = 'none';
            activeTab = name;
        }
    });
});

document.querySelectorAll('[panel]').forEach((panel, index) => {
    panel.style.display = index === 0 ? 'block' : 'none';
});
