const menu = document.querySelector('#mobile-menu');
const menuLinks = document.querySelector('.navbar__menu');
const navLogo = document.querySelector('#navbar__logo')

//Mobile Menu
menu.addEventListener('click', function(){
    menu.classList.toggle('is-active');
    menuLinks.classList.toggle('active');
});

function Home() {
    window.location.href = "income.html";
}
function incomeHistory() {
    window.location.href = "History.html";
}
function spending() {
    window.location.href = "spending.html";
}



