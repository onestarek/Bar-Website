function scheduleRedirect() {
    const now = new Date();
    const redirectTimes = [
        new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 0),
        new Date(now.getFullYear(), now.getMonth(), now.getDate(), 11, 59, 0)
    ];

    const nextRedirect = redirectTimes.find(time => time > now) || new Date(redirectTimes[0].getTime() + 24 * 60 * 60 * 1000);

    localStorage.setItem('redirectTime', nextRedirect);

    const timeUntilRedirect = nextRedirect - now;

    setTimeout(() => {
        window.location.href = '/logout';
    }, timeUntilRedirect);
}
function startLogoutTimer() {
    const timerElement = document.getElementById('logout-timer');

    function updateTimer() {
        const redirectTime = localStorage.getItem('redirectTime');
        if (!redirectTime) {
            timerElement.textContent = 'Brak zaplanowanego wylogowania';
            return;
        }

        const now = new Date();
        const targetTime = new Date(redirectTime);
        const timeRemaining = targetTime - now;

        if (timeRemaining <= 0) {
            timerElement.textContent = 'Wylogowanie w toku...';
            clearInterval(timerInterval);
            return;
        }

        const hours = Math.floor(timeRemaining / (1000 * 60 * 60));
        const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));

        timerElement.textContent = `Pozostały czas do wylogowania: ${hours}h ${minutes}m`;
    }

    const timerInterval = setInterval(updateTimer, 60000);
    updateTimer();
}

function checkRedirect() {
    const redirectTime = localStorage.getItem('redirectTime');
    if (redirectTime) {
        const now = new Date();
        const targetTime = new Date(redirectTime);

        if (targetTime > now) {
            const timeUntilRedirect = targetTime - now;

            setTimeout(() => {
                window.location.href = '/logout';
            }, timeUntilRedirect);
            
        } else {
            localStorage.removeItem('redirectTime');
            scheduleRedirect();
        }
    } else {
        scheduleRedirect();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    let products = [];
    let presets = [];

    fetch('jsons/cennik.json')
        .then(response => response.json())
        .then(data => {
            products = data.products;
            presets = data.presets;
            displayProductList();
            populatePresetDropdown();
        })
        .catch(error => console.error('Błąd wczytywania danych z JSON:', error));

    const productList = document.getElementById('product-list');
    const presetDropdown = document.getElementById('preset-dropdown');
    const orderSummary = document.getElementById('order-summary');

    function displayProductList() {
        productList.innerHTML = '';
        products.forEach(product => {
            const productItem = document.createElement('div');
            productItem.classList.add('product-item');

            productItem.innerHTML = `
                <label>${product.nazwa} (${product.kategoria})</label>
                <div class="quantity-control">
                    <input type="number" class="product-quantity" min="0" value="0" data-price="${product.cena}">
                    <button class="decrease-btn">-</button>
                    <button class="increase-btn">+</button>
                </div>
            `;
            productList.appendChild(productItem);

            const decreaseBtn = productItem.querySelector('.decrease-btn');
            const increaseBtn = productItem.querySelector('.increase-btn');
            const quantityInput = productItem.querySelector('.product-quantity');

            decreaseBtn.addEventListener('click', () => {
                if (quantityInput.value > 0) {
                    quantityInput.value = parseInt(quantityInput.value) - 1;
                    calculateTotal();
                }
            });

            increaseBtn.addEventListener('click', () => {
                quantityInput.value = parseInt(quantityInput.value) + 1;
                calculateTotal();
            });

            quantityInput.addEventListener('input', calculateTotal);
        });
    }
    let presetindex = 0;
    function calculateTotal() {
        const quantities = document.querySelectorAll('.product-quantity');
        let total = 0;
        orderSummary.innerHTML = '';
        const hiddenOrderSummary = document.getElementById('hidden-order-summary');
        hiddenOrderSummary.innerHTML = '';

        quantities.forEach(quantityInput => {
            const quantity = parseInt(quantityInput.value) || 0;
            const price = parseFloat(quantityInput.dataset.price);
            const productName = quantityInput.closest('.product-item').querySelector('label').textContent;

            if (quantity > 0) {
                total += quantity * price;
                const listItem = document.createElement('li');
                listItem.textContent = `${quantity}x ${productName}`;
                orderSummary.appendChild(listItem);

                const hiddenListItem = document.createElement('li');
                hiddenListItem.textContent = `${quantity}x ${productName}\n`;
                hiddenOrderSummary.appendChild(hiddenListItem);
            }
        });

        document.querySelectorAll('.preset-quantity').forEach((input) => {
            const quantity = parseInt(input.value) || 0;
            if (quantity > 0) {
                const preset = presets[presetindex];
                total += quantity * preset.cena;

                const presetItem = document.createElement('li');
                presetItem.textContent = `${quantity}x ${preset.name}:`;
                orderSummary.appendChild(presetItem);

                const hiddenPresetItem = document.createElement('li');
                hiddenPresetItem.textContent = `${quantity}x ${preset.name}:\n`;
                hiddenOrderSummary.appendChild(hiddenPresetItem);

                preset.items.forEach(item => {
                    const subItem = document.createElement('li');
                    subItem.textContent = `- ${item.quantity*quantity}x ${item.nazwa}`;
                    subItem.style.marginLeft = '20px';
                    orderSummary.appendChild(subItem);

                    const hiddenSubItem = document.createElement('li');
                    hiddenSubItem.textContent = `- ${item.quantity*quantity}x ${item.nazwa}\n`;
                    hiddenSubItem.style.marginLeft = '20px';
                    hiddenOrderSummary.appendChild(hiddenSubItem);
                });
            }
        });

        document.getElementById('total-amount').textContent = `${total}$`;
    }

    document.getElementById('clear-btn').addEventListener('click', () => {
        document.querySelectorAll('.product-quantity').forEach(input => input.value = 0);
        document.querySelectorAll('.preset-quantity').forEach(input => input.value = 0);
        presetDropdown.value = "";
        orderSummary.innerHTML = '';
        document.getElementById('total-amount').textContent = '0$';
    });

    document.getElementById('send').addEventListener('click', () => {
        const totalprice = document.getElementById('total-amount').textContent;
        const items = document.getElementById('hidden-order-summary').textContent;

        if(!totalprice || !items){
            return alert('Nie można wysłać pustego zamówienia!')
        } else {
            fetch(`/wyslij`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ items, totalprice }),
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    alert('Wysłano!');
                    window.location.reload();
                } else {
                    alert('Błąd przy wysyłaniu');
                }
            })
            .catch(error => {
                console.error('Error:', error);
            });
        }
    });

    function populatePresetDropdown() {
        presets.forEach((preset, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = `${preset.name} (${preset.cena}$)`;
            presetDropdown.appendChild(option);
        });

        presetDropdown.addEventListener('change', loadPreset);
    }

    function loadPreset() {
        const selectedIndex = parseInt(presetDropdown.value);
        const quantityInput = document.getElementById('preset-quantity');
        presetindex = selectedIndex;

        if (isNaN(selectedIndex) || !presets[selectedIndex]) {
            orderSummary.innerHTML = '';
            quantityInput.value = 0; 
            calculateTotal();
            return;
        }
        
        const selectedPreset = presets[selectedIndex];

        orderSummary.innerHTML = '';
    
        const presetItem = document.createElement('li');
        presetItem.textContent = `${quantityInput.value}x ${selectedPreset.name}`;
        orderSummary.appendChild(presetItem);
    
        selectedPreset.items.forEach(item => {
            const subItem = document.createElement('li');
            subItem.textContent = `- ${quantityInput.value * item.quantity}x ${item.nazwa}`;
            subItem.style.marginLeft = '20px';
            orderSummary.appendChild(subItem);
        });
    
        calculateTotal();
    }
    document.getElementById('search-input').addEventListener('input', function () {
        const query = this.value.toLowerCase();
        const productItems = document.querySelectorAll('.product-item');
    
        productItems.forEach(item => {
            const productName = item.querySelector('label').textContent.toLowerCase();
            if (productName.includes(query)) {
                item.style.display = '';
            } else {
                item.style.display = 'none';
            }
        });
    });
    document.getElementById('preset-quantity').addEventListener('input', () => {
        loadPreset();
        calculateTotal();
    });
    loadPreset();
    checkRedirect();
    startLogoutTimer();
});