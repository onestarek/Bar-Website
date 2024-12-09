let products = [];
let presets = [];
document.addEventListener('DOMContentLoaded', () => {
    fetch('jsons/cennik.json')
        .then(response => response.json())
        .then(data => {
            products = data.products;
            presets = data.presets;
            displayMenuContent();
        })
        .catch(error => console.error('Błąd wczytywania danych z JSON:', error));
    setInterval(disableLogin, 60 * 1000);
    disableLogin();

    const formContainer = document.getElementById('contact-form-container');
    const contactButton = document.getElementById('contact-btn');
    const closeFormButton = formContainer.querySelector('.close-btn');
    const overlay = formContainer.querySelector('.form-overlay');

    contactButton.addEventListener('click', () => {
        formContainer.style.display = 'flex';
    });

    closeFormButton.addEventListener('click', () => {
        formContainer.style.display = 'none';
        form.reset();
    });

    overlay.addEventListener('click', () => {
        formContainer.style.display = 'none';
    });

    const form = document.getElementById('contact-form');
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const daneformularza = Object.fromEntries(formData)
        fetch(`/formularz`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ daneformularza }),
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert('Dziękujemy za zgłoszenie!');
                form.reset();
                formContainer.style.display = 'none';
            } else {
                alert('Błąd przy wysyłaniu');
                form.reset();
                formContainer.style.display = 'none';
            }
        })
        .catch(error => {
            console.error('Error:', error);
        });
    });
})
function disableLogin() {
    const loginButton = document.querySelector('.login-btn');
    const now = new Date();

    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const restrictedPeriods = [
        { start: 11 * 60 + 59, end: 12 * 60 + 1 },
        { start: 23 * 60 + 59, end: 0 * 60 + 1 + 1440 }
    ];

    const isRestricted = restrictedPeriods.some(period => 
        (currentMinutes >= period.start && currentMinutes <= period.end) ||
        (period.start > 1440 && (currentMinutes >= period.start - 1440 || currentMinutes <= period.end))
    );

    if (isRestricted) {
        loginButton.classList.add('disabled');
        loginButton.setAttribute('disabled', 'true');
        loginButton.textContent = 'Logowanie';
        // window.location.reload();
    } else {
        loginButton.classList.remove('disabled');
        loginButton.removeAttribute('disabled');
        loginButton.textContent = 'Logowanie';
        // window.location.reload();
    }
}

function displayMenuContent() {
    const menuContent = document.getElementById('menu-content');
    menuContent.innerHTML = '';

    const categories = [...new Set(products.map(product => product.kategoria))];

    categories.forEach(category => {
        const categorySection = document.createElement('div');
        categorySection.classList.add('category-section');

        const categoryTitle = document.createElement('div');
        categoryTitle.classList.add('category-title');
        categoryTitle.textContent = category;

        const productList = document.createElement('div');
        productList.classList.add('product-list');

        products.filter(product => product.kategoria === category).forEach(product => {
            const productItem = document.createElement('div');
            productItem.classList.add('product-item');

            productItem.innerHTML = `
                <h3>${product.nazwa}</h3>
                <p class="price">Cena: ${product.cena}$</p>
            `;
            productList.appendChild(productItem);
        });

        categorySection.appendChild(categoryTitle);
        categorySection.appendChild(productList);
        menuContent.appendChild(categorySection);
    });

    const presetSection = document.createElement('div');
    presetSection.classList.add('category-section');

    const presetTitle = document.createElement('div');
    presetTitle.classList.add('category-title');
    presetTitle.textContent = 'Zestawy';

    const presetList = document.createElement('div');
    presetList.classList.add('preset-list');

    presets.forEach(preset => {
        const presetItem = document.createElement('div');
        presetItem.classList.add('preset-item');

        let itemsList = preset.items.map(item => `<li>${item.quantity}x ${item.nazwa}</li>`).join('');
        presetItem.innerHTML = `
            <h3>${preset.name}</h3>
            <p class="price">Cena: ${preset.cena}$</p>
            <ul>${itemsList}</ul>
        `;

        presetList.appendChild(presetItem);
    });

    presetSection.appendChild(presetTitle);
    presetSection.appendChild(presetList);
    menuContent.appendChild(presetSection);
}
