// Pokémon Master - Enhanced Pokedex
class PokemonMaster {
    constructor() {
        this.pokemon = [];
        this.filteredPokemon = [];
        this.favorites = new Set();
        this.currentPage = 1;
        this.pokemonPerPage = 20;
        this.isLoading = false;
        this.currentFilters = {
            search: '',
            type: 'all',
            sort: 'number',
            showFavorites: false
        };

        this.init();
    }

    async init() {
        await this.loadFavorites();
        this.setupEventListeners();
        await this.loadPokemon();
        this.hideLoadingScreen();
        this.showNotification('Pokédex loaded successfully!', 'success');
        console.log('🎮 Pokémon Master initialized');
    }

    // DOM Elements
    getElements() {
        return {
            // Containers
            pokeContainer: document.getElementById('pokeContainer'),
            loadingScreen: document.getElementById('loadingScreen'),
            emptyState: document.getElementById('emptyState'),
            
            // Controls
            searchInput: document.getElementById('searchInput'),
            clearSearch: document.getElementById('clearSearch'),
            typeFilter: document.getElementById('typeFilter'),
            sortSelect: document.getElementById('sortSelect'),
            toggleFavorites: document.getElementById('toggleFavorites'),
            loadMore: document.getElementById('loadMore'),
            
            // Stats
            totalCount: document.getElementById('totalCount'),
            showingCount: document.getElementById('showingCount'),
            favoritesCount: document.getElementById('favoritesCount'),
            
            // Modal
            pokemonModal: document.getElementById('pokemonModal'),
            modalClose: document.getElementById('modalClose'),
            modalName: document.getElementById('modalName'),
            modalBody: document.getElementById('modalBody'),
            
            // Notification
            notification: document.getElementById('notification')
        };
    }

    // Event Listeners
    setupEventListeners() {
        const el = this.getElements();

        // Search functionality
        el.searchInput.addEventListener('input', (e) => {
            this.currentFilters.search = e.target.value.toLowerCase();
            this.applyFilters();
            this.toggleClearSearch();
        });

        el.clearSearch.addEventListener('click', () => {
            el.searchInput.value = '';
            this.currentFilters.search = '';
            this.applyFilters();
            this.toggleClearSearch();
        });

        // Filters
        el.typeFilter.addEventListener('change', (e) => {
            this.currentFilters.type = e.target.value;
            this.applyFilters();
        });

        el.sortSelect.addEventListener('change', (e) => {
            this.currentFilters.sort = e.target.value;
            this.applyFilters();
        });

        // Favorites toggle
        el.toggleFavorites.addEventListener('click', () => {
            this.currentFilters.showFavorites = !this.currentFilters.showFavorites;
            el.toggleFavorites.classList.toggle('active', this.currentFilters.showFavorites);
            el.toggleFavorites.innerHTML = this.currentFilters.showFavorites ? 
                '<i class="fas fa-heart"></i> All Pokémon' : 
                '<i class="far fa-heart"></i> Favorites';
            this.applyFilters();
        });

        // Load more
        el.loadMore.addEventListener('click', () => {
            this.loadMorePokemon();
        });

        // Modal
        el.modalClose.addEventListener('click', () => {
            this.closeModal();
        });

        el.pokemonModal.addEventListener('click', (e) => {
            if (e.target === el.pokemonModal) {
                this.closeModal();
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
            }
            if (e.key === 'Enter' && document.activeElement !== el.searchInput) {
                this.loadMorePokemon();
            }
        });
    }

    // Pokémon Data Management
    async loadPokemon() {
        this.showLoading();
        const totalPokemon = 151; // First generation
        
        try {
            // Load in batches for better performance
            const batchSize = 20;
            for (let i = 1; i <= totalPokemon; i += batchSize) {
                const batch = [];
                for (let j = i; j < i + batchSize && j <= totalPokemon; j++) {
                    batch.push(this.fetchPokemonData(j));
                }
                
                const batchResults = await Promise.allSettled(batch);
                const successfulPokemon = batchResults
                    .filter(result => result.status === 'fulfilled')
                    .map(result => result.value);
                
                this.pokemon.push(...successfulPokemon);
                this.updateStats();
                
                // Render initial batch immediately
                if (i === 1) {
                    this.applyFilters();
                }
            }
            
            console.log(`✅ Loaded ${this.pokemon.length} Pokémon`);
        } catch (error) {
            console.error('Error loading Pokémon:', error);
            this.showNotification('Error loading Pokémon data', 'error');
        } finally {
            this.hideLoading();
        }
    }

    async fetchPokemonData(id) {
        const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
        if (!response.ok) throw new Error(`Failed to fetch Pokémon ${id}`);
        
        const data = await response.json();
        return this.transformPokemonData(data);
    }

    transformPokemonData(data) {
        return {
            id: data.id,
            name: data.name,
            displayName: this.capitalizeFirstLetter(data.name),
            number: data.id.toString().padStart(3, '0'),
            types: data.types.map(type => type.type.name),
            image: data.sprites.other['official-artwork'].front_default || 
                   data.sprites.front_default,
            stats: data.stats.reduce((acc, stat) => {
                acc[stat.stat.name] = stat.base_stat;
                return acc;
            }, {}),
            height: data.height / 10, // Convert to meters
            weight: data.weight / 10, // Convert to kilograms
            abilities: data.abilities.map(ability => ability.ability.name),
            moves: data.moves.slice(0, 5).map(move => move.move.name) // First 5 moves
        };
    }

    // Filtering and Sorting
    applyFilters() {
        let filtered = [...this.pokemon];

        // Search filter
        if (this.currentFilters.search) {
            filtered = filtered.filter(pokemon => 
                pokemon.name.includes(this.currentFilters.search) ||
                pokemon.displayName.toLowerCase().includes(this.currentFilters.search) ||
                pokemon.number.includes(this.currentFilters.search)
            );
        }

        // Type filter
        if (this.currentFilters.type !== 'all') {
            filtered = filtered.filter(pokemon => 
                pokemon.types.includes(this.currentFilters.type)
            );
        }

        // Favorites filter
        if (this.currentFilters.showFavorites) {
            filtered = filtered.filter(pokemon => this.favorites.has(pokemon.id));
        }

        // Sorting
        filtered.sort((a, b) => {
            switch (this.currentFilters.sort) {
                case 'name':
                    return a.displayName.localeCompare(b.displayName);
                case 'type':
                    return a.types[0].localeCompare(b.types[0]);
                default: // number
                    return a.id - b.id;
            }
        });

        this.filteredPokemon = filtered;
        this.currentPage = 1;
        this.renderPokemon();
        this.updateStats();
        this.toggleLoadMore();
    }

    // Rendering
    renderPokemon() {
        const el = this.getElements();
        const startIndex = 0;
        const endIndex = this.currentPage * this.pokemonPerPage;
        const pokemonToShow = this.filteredPokemon.slice(startIndex, endIndex);

        if (pokemonToShow.length === 0) {
            el.emptyState.classList.add('show');
            el.pokeContainer.innerHTML = '';
            return;
        }

        el.emptyState.classList.remove('show');
        
        const pokemonHTML = pokemonToShow.map(pokemon => this.createPokemonCard(pokemon)).join('');
        el.pokeContainer.innerHTML = pokemonHTML;

        // Add click listeners to new cards
        pokemonToShow.forEach(pokemon => {
            const card = document.querySelector(`[data-pokemon-id="${pokemon.id}"]`);
            if (card) {
                card.addEventListener('click', () => this.showPokemonDetails(pokemon.id));
                
                const favoriteBtn = card.querySelector('.favorite-btn');
                if (favoriteBtn) {
                    favoriteBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.toggleFavorite(pokemon.id);
                    });
                }
            }
        });
    }

    createPokemonCard(pokemon) {
        const isFavorite = this.favorites.has(pokemon.id);
        const mainType = pokemon.types[0];
        const typeBadges = pokemon.types.map(type => 
            `<span class="type-badge type-${type}">${type}</span>`
        ).join('');

        return `
            <div class="pokemon ${isFavorite ? 'favorite' : ''}" data-pokemon-id="${pokemon.id}">
                <div class="pokemon-header">
                    <span class="pokemon-number">#${pokemon.number}</span>
                    <button class="favorite-btn ${isFavorite ? 'active' : ''}" 
                            title="${isFavorite ? 'Remove from favorites' : 'Add to favorites'}">
                        <i class="${isFavorite ? 'fas' : 'far'} fa-heart"></i>
                    </button>
                </div>
                
                <div class="pokemon-img">
                    <img src="${pokemon.image}" 
                         alt="${pokemon.displayName}" 
                         loading="lazy"
                         onerror="this.src='https://via.placeholder.com/150/666666/FFFFFF?text=?'">
                </div>
                
                <h3 class="pokemon-name">${pokemon.displayName}</h3>
                
                <div class="pokemon-types">
                    ${typeBadges}
                </div>
            </div>
        `;
    }

    // Favorites Management
    toggleFavorite(pokemonId) {
        if (this.favorites.has(pokemonId)) {
            this.favorites.delete(pokemonId);
            this.showNotification('Removed from favorites', 'success');
        } else {
            this.favorites.add(pokemonId);
            this.showNotification('Added to favorites!', 'success');
        }
        
        this.saveFavorites();
        this.applyFilters(); // Re-render to update favorite states
    }

    async loadFavorites() {
        try {
            const saved = localStorage.getItem('pokemonMasterFavorites');
            if (saved) {
                const favoriteIds = JSON.parse(saved);
                this.favorites = new Set(favoriteIds);
            }
        } catch (error) {
            console.error('Error loading favorites:', error);
        }
    }

    saveFavorites() {
        try {
            const favoriteIds = Array.from(this.favorites);
            localStorage.setItem('pokemonMasterFavorites', JSON.stringify(favoriteIds));
            this.updateStats();
        } catch (error) {
            console.error('Error saving favorites:', error);
        }
    }

    // Pokémon Details Modal
    async showPokemonDetails(pokemonId) {
        const pokemon = this.pokemon.find(p => p.id === pokemonId);
        if (!pokemon) return;

        const el = this.getElements();
        el.modalName.textContent = pokemon.displayName;
        
        // Show loading state in modal
        el.modalBody.innerHTML = `
            <div class="modal-loading">
                <div class="loading-spinner"></div>
                <p>Loading details...</p>
            </div>
        `;

        el.pokemonModal.classList.add('show');

        try {
            // Fetch additional data for details
            const [speciesData] = await Promise.all([
                this.fetchPokemonSpecies(pokemonId)
            ]);

            const modalContent = this.createModalContent(pokemon, speciesData);
            el.modalBody.innerHTML = modalContent;

            // Add event listeners to modal buttons
            this.setupModalEventListeners(pokemonId);

        } catch (error) {
            console.error('Error loading Pokémon details:', error);
            el.modalBody.innerHTML = `
                <div class="modal-error">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Failed to load details</p>
                </div>
            `;
        }
    }

    async fetchPokemonSpecies(pokemonId) {
        const response = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${pokemonId}`);
        if (!response.ok) throw new Error('Failed to fetch species data');
        return await response.json();
    }

    createModalContent(pokemon, speciesData) {
        const isFavorite = this.favorites.has(pokemon.id);
        const description = this.getEnglishDescription(speciesData);
        const typeBadges = pokemon.types.map(type => 
            `<span class="type-badge type-${type}">${type}</span>`
        ).join('');

        return `
            <div class="pokemon-details">
                <div class="details-header">
                    <div class="details-image">
                        <img src="${pokemon.image}" alt="${pokemon.displayName}">
                    </div>
                    <div class="details-info">
                        <div class="details-number">#${pokemon.number}</div>
                        <div class="details-types">${typeBadges}</div>
                        <button class="btn ${isFavorite ? 'btn-primary' : 'btn-secondary'} favorite-modal-btn">
                            <i class="${isFavorite ? 'fas' : 'far'} fa-heart"></i>
                            ${isFavorite ? 'Favorite' : 'Add to Favorites'}
                        </button>
                    </div>
                </div>

                <div class="details-section">
                    <h3>Description</h3>
                    <p class="description">${description || 'No description available.'}</p>
                </div>

                <div class="details-grid">
                    <div class="details-section">
                        <h3>Physical Characteristics</h3>
                        <div class="characteristics">
                            <div class="characteristic">
                                <span class="label">Height:</span>
                                <span class="value">${pokemon.height}m</span>
                            </div>
                            <div class="characteristic">
                                <span class="label">Weight:</span>
                                <span class="value">${pokemon.weight}kg</span>
                            </div>
                            <div class="characteristic">
                                <span class="label">Abilities:</span>
                                <span class="value">${pokemon.abilities.map(ab => this.capitalizeFirstLetter(ab)).join(', ')}</span>
                            </div>
                        </div>
                    </div>

                    <div class="details-section">
                        <h3>Base Stats</h3>
                        <div class="stats">
                            ${Object.entries(pokemon.stats).map(([stat, value]) => `
                                <div class="stat">
                                    <span class="stat-label">${this.formatStatName(stat)}:</span>
                                    <div class="stat-bar">
                                        <div class="stat-progress" style="width: ${(value / 255) * 100}%"></div>
                                    </div>
                                    <span class="stat-value">${value}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>

                ${pokemon.moves.length > 0 ? `
                    <div class="details-section">
                        <h3>Known Moves</h3>
                        <div class="moves">
                            ${pokemon.moves.map(move => `
                                <span class="move-tag">${this.capitalizeFirstLetter(move)}</span>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }

    setupModalEventListeners(pokemonId) {
        const favoriteBtn = document.querySelector('.favorite-modal-btn');
        if (favoriteBtn) {
            favoriteBtn.addEventListener('click', () => {
                this.toggleFavorite(pokemonId);
                this.closeModal();
                this.showPokemonDetails(pokemonId); // Reload modal to update state
            });
        }
    }

    closeModal() {
        const el = this.getElements();
        el.pokemonModal.classList.remove('show');
    }

    // Utility Functions
    getEnglishDescription(speciesData) {
        const englishEntry = speciesData.flavor_text_entries?.find(
            entry => entry.language.name === 'en'
        );
        return englishEntry ? englishEntry.flavor_text.replace(/\f/g, ' ') : null;
    }

    capitalizeFirstLetter(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }

    formatStatName(stat) {
        const statNames = {
            'hp': 'HP',
            'attack': 'Attack',
            'defense': 'Defense',
            'special-attack': 'Sp. Atk',
            'special-defense': 'Sp. Def',
            'speed': 'Speed'
        };
        return statNames[stat] || stat;
    }

    // Pagination
    loadMorePokemon() {
        if (this.isLoading) return;
        
        const totalPages = Math.ceil(this.filteredPokemon.length / this.pokemonPerPage);
        if (this.currentPage >= totalPages) return;

        this.currentPage++;
        this.renderPokemon();
        this.toggleLoadMore();
    }

    toggleLoadMore() {
        const el = this.getElements();
        const totalPages = Math.ceil(this.filteredPokemon.length / this.pokemonPerPage);
        el.loadMore.style.display = this.currentPage < totalPages ? 'block' : 'none';
    }

    toggleClearSearch() {
        const el = this.getElements();
        el.clearSearch.style.display = this.currentFilters.search ? 'block' : 'none';
    }

    // Stats and UI Updates
    updateStats() {
        const el = this.getElements();
        el.totalCount.textContent = this.pokemon.length;
        el.showingCount.textContent = this.filteredPokemon.length;
        el.favoritesCount.textContent = this.favorites.size;
    }

    showLoading() {
        this.isLoading = true;
        // You can add a loading indicator here if needed
    }

    hideLoading() {
        this.isLoading = false;
    }

    hideLoadingScreen() {
        const el = this.getElements();
        setTimeout(() => {
            el.loadingScreen.classList.add('hidden');
        }, 500);
    }

    // Notification System
    showNotification(message, type = 'success') {
        const el = this.getElements();
        const notification = el.notification;
        
        notification.className = `notification ${type}`;
        notification.querySelector('.notification-text').textContent = message;
        notification.classList.add('show');

        // Auto hide
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);

        // Close button
        notification.querySelector('.notification-close').onclick = () => {
            notification.classList.remove('show');
        };
    }
}

// Additional CSS for modal content (dynamically added)
const modalStyles = `
    .modal-loading, .modal-error {
        text-align: center;
        padding: 3rem 2rem;
        color: var(--gray);
    }

    .loading-spinner {
        width: 40px;
        height: 40px;
        border: 3px solid rgba(255, 255, 255, 0.3);
        border-top: 3px solid var(--primary);
        border-radius: 50%;
        margin: 0 auto 1rem;
        animation: spin 1s linear infinite;
    }

    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }

    .pokemon-details {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
    }

    .details-header {
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 1.5rem;
        align-items: start;
    }

    .details-image {
        text-align: center;
    }

    .details-image img {
        width: 150px;
        height: 150px;
        object-fit: contain;
    }

    .details-info {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }

    .details-number {
        background: var(--primary);
        color: white;
        padding: 0.5rem 1rem;
        border-radius: 20px;
        font-weight: 700;
        font-size: 0.9rem;
        display: inline-block;
        width: fit-content;
    }

    .details-types {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
    }

    .details-section h3 {
        font-size: 1.1rem;
        font-weight: 600;
        margin-bottom: 0.8rem;
        color: var(--light);
    }

    .description {
        line-height: 1.6;
        color: var(--gray-light);
    }

    .details-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1.5rem;
    }

    .characteristics {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .characteristic {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.5rem 0;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }

    .characteristic:last-child {
        border-bottom: none;
    }

    .label {
        font-weight: 500;
        color: var(--gray);
    }

    .value {
        font-weight: 600;
        color: var(--light);
    }

    .stats {
        display: flex;
        flex-direction: column;
        gap: 0.8rem;
    }

    .stat {
        display: flex;
        align-items: center;
        gap: 0.8rem;
    }

    .stat-label {
        font-weight: 500;
        color: var(--gray);
        min-width: 60px;
        font-size: 0.9rem;
    }

    .stat-bar {
        flex: 1;
        height: 8px;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 4px;
        overflow: hidden;
    }

    .stat-progress {
        height: 100%;
        background: var(--primary);
        border-radius: 4px;
        transition: width 0.3s ease;
    }

    .stat-value {
        font-weight: 600;
        color: var(--light);
        min-width: 30px;
        text-align: right;
        font-size: 0.9rem;
    }

    .moves {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
    }

    .move-tag {
        background: rgba(255, 255, 255, 0.1);
        padding: 0.4rem 0.8rem;
        border-radius: 20px;
        font-size: 0.8rem;
        color: var(--light);
    }

    @media (max-width: 768px) {
        .details-header {
            grid-template-columns: 1fr;
            text-align: center;
        }

        .details-info {
            align-items: center;
        }

        .details-grid {
            grid-template-columns: 1fr;
        }
    }
`;

// Add modal styles to document
const styleSheet = document.createElement('style');
styleSheet.textContent = modalStyles;
document.head.appendChild(styleSheet);

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    window.pokemonMaster = new PokemonMaster();
});

// Console welcome message
console.log(`
%c
🎮 POKÉMON MASTER POKÉDEX 🎮
                               
✨ Features Activated:          
✓ Advanced search & filtering  
✓ Favorite system              
✓ Detailed Pokémon info       
✓ Responsive design           
✓ Performance optimized       
✓ Beautiful animations        
✓ Keyboard shortcuts          
                               
Gotta Catch 'Em All! 🎯        
`,
'color: #DC0A2D; font-family: "Courier New", monospace; font-weight: bold;'
);