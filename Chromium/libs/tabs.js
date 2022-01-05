var activeTab = 0;
var tabs = document.querySelectorAll('[tab]');
var panels = document.querySelectorAll('[panel]');

tabs[activeTab].classList.add('checked');
panels[activeTab].style.display = 'block';
tabs.forEach((tab, index) => {
    tab.addEventListener('click', event => {
        tabs[activeTab].classList.remove('checked');
        panels[activeTab].style.display = 'none';
        activeTab = index;
        tabs[index].classList.add('checked');
        panels[index].style.display = 'block';
    });
});
