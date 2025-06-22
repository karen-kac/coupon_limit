class AdminApp {
    constructor() {
        this.API_BASE_URL = 'http://localhost:8000/api';
        this.currentView = 'dashboard';
        this.admin = null;
        this.store = null;
        this.coupons = [];
        this.stores = [];
        this.discountSchedule = [
            { time_remain_min: 60, rate: 20 },
            { time_remain_min: 30, rate: 30 },
            { time_remain_min: 10, rate: 50 }
        ];
        this.notificationContainer = null;
        this.currentFilters = {
            store: '',
            status: ''
        };
        this.filteredCoupons = [];
        this.init();
    }

    init() {
        this.createNotificationContainer();
        this.checkAuthStatus();
        this.setupEventListeners();
        this.loadAvailableStores();
    }

    // Notification system
    createNotificationContainer() {
        this.notificationContainer = document.createElement('div');
        this.notificationContainer.className = 'notification-container';
        document.body.appendChild(this.notificationContainer);
    }

    showNotification(message, type = 'success', duration = 4000) {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };

        notification.innerHTML = `
            <span class="notification-icon">${icons[type] || icons.success}</span>
            <span class="notification-message">${message}</span>
            <button class="notification-close" onclick="this.parentElement.remove()">×</button>
        `;

        this.notificationContainer.appendChild(notification);

        // Trigger animation
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);

        // Auto remove
        if (duration > 0) {
            setTimeout(() => {
                this.removeNotification(notification);
            }, duration);
        }

        return notification;
    }

    removeNotification(notification) {
        if (notification && notification.parentElement) {
            notification.classList.remove('show');
            setTimeout(() => {
                if (notification.parentElement) {
                    notification.remove();
                }
            }, 400);
        }
    }

    // Convenience methods
    showSuccessNotification(message, duration = 4000) {
        return this.showNotification(message, 'success', duration);
    }

    showErrorNotification(message, duration = 6000) {
        return this.showNotification(message, 'error', duration);
    }

    showWarningNotification(message, duration = 5000) {
        return this.showNotification(message, 'warning', duration);
    }

    showInfoNotification(message, duration = 4000) {
        return this.showNotification(message, 'info', duration);
    }

    // Confirmation Modal System
    showConfirmModal(options = {}) {
        return new Promise((resolve) => {
            const modal = document.getElementById('confirm-modal');
            const titleEl = document.getElementById('confirm-title');
            const messageEl = document.getElementById('confirm-message');
            const cancelBtn = document.getElementById('confirm-cancel');
            const okBtn = document.getElementById('confirm-ok');

            // Set content
            titleEl.textContent = options.title || '確認';
            messageEl.textContent = options.message || 'この操作を実行しますか？';
            cancelBtn.textContent = options.cancelText || 'キャンセル';
            okBtn.textContent = options.okText || 'OK';

            // Set button style
            okBtn.className = `btn ${options.danger ? 'btn-danger' : 'btn-primary'}`;

            // Show modal
            modal.style.display = 'flex';

            // Event handlers
            const handleCancel = () => {
                modal.style.display = 'none';
                cancelBtn.removeEventListener('click', handleCancel);
                okBtn.removeEventListener('click', handleOk);
                resolve(false);
            };

            const handleOk = () => {
                modal.style.display = 'none';
                cancelBtn.removeEventListener('click', handleCancel);
                okBtn.removeEventListener('click', handleOk);
                resolve(true);
            };

            cancelBtn.addEventListener('click', handleCancel);
            okBtn.addEventListener('click', handleOk);

            // Close on background click
            const handleBackgroundClick = (e) => {
                if (e.target === modal) {
                    handleCancel();
                    modal.removeEventListener('click', handleBackgroundClick);
                }
            };
	        modal.addEventListener('click', handleBackgroundClick);
        });
    }

    // Convenience method for dangerous actions
    showDeleteConfirm(itemName = 'この項目') {
        return this.showConfirmModal({
            title: '削除の確認',
            message: `${itemName}を削除しますか？この操作は取り消せません。`,
            cancelText: 'キャンセル',
            okText: '削除',
            danger: true
        });
    }

    // Authentication methods
    getAdminAuthToken() {
        return localStorage.getItem('admin_auth_token');
    }

    setAdminAuthToken(token) {
        localStorage.setItem('admin_auth_token', token);
    }

    removeAdminAuthToken() {
        localStorage.removeItem('admin_auth_token');
    }

    async adminAuthFetch(url, options = {}) {
        const token = this.getAdminAuthToken();
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers,
        };

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        return fetch(url, {
            ...options,
            headers,
        });
    }

    async checkAuthStatus() {
        const token = this.getAdminAuthToken();
        if (!token) {
            this.showLoginScreen();
            return;
        }

        try {
            const response = await this.adminAuthFetch(`${this.API_BASE_URL}/admin/auth/verify`);
            if (!response.ok) {
                this.removeAdminAuthToken();
                this.showLoginScreen();
                return;
            }

            const adminResponse = await this.adminAuthFetch(`${this.API_BASE_URL}/admin/auth/me`);
            if (adminResponse.ok) {
                this.admin = await adminResponse.json();
                
                if (this.admin.role === 'store_owner') {
                    await this.loadStoreInfo();
                }
                
                this.showAdminApp();
            } else {
                this.showLoginScreen();
            }
        } catch (error) {
            console.error('Auth check failed:', error);
            this.showLoginScreen();
        }
    }

    async loadStoreInfo() {
        try {
            const response = await this.adminAuthFetch(`${this.API_BASE_URL}/admin/stores`);
            if (response.ok) {
                const stores = await response.json();
                this.store = stores.length > 0 ? stores[0] : null;
            }
        } catch (error) {
            console.error('Failed to load store info:', error);
        }
    }

    async refreshAdminInfo() {
        try {
            const adminResponse = await this.adminAuthFetch(`${this.API_BASE_URL}/admin/auth/me`);
            if (adminResponse.ok) {
                this.admin = await adminResponse.json();
                console.log('Admin info refreshed:', this.admin); // デバッグ用
                
                if (this.admin.role === 'store_owner') {
                    await this.loadStoreInfo();
                }
                
                this.updateUserInfo();
            }
        } catch (error) {
            console.error('Failed to refresh admin info:', error);
        }
    }

    showLoginScreen() {
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('register-screen').style.display = 'none';
        document.getElementById('admin-app').style.display = 'none';
    }

    showRegisterScreen() {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('register-screen').style.display = 'flex';
        document.getElementById('admin-app').style.display = 'none';
    }

    showAdminApp() {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('register-screen').style.display = 'none';
        document.getElementById('admin-app').style.display = 'block';
        
        this.updateUserInfo();
        this.showView('dashboard');
        this.loadDashboard();
    }

    updateUserInfo() {
        document.getElementById('admin-email').textContent = this.admin.email;
        document.getElementById('admin-role').textContent = 
            this.admin.role === 'store_owner' ? '店舗オーナー' : 'スーパー管理者';
        
        if (this.store) {
            document.getElementById('current-store-name').textContent = this.store.name;
        }

        document.getElementById('welcome-message').textContent = 
            `ようこそ、${this.admin.role === 'store_owner' ? this.store?.name : 'スーパー管理者'}さん`;

        // Show store management for super admin
        if (this.admin.role === 'super_admin') {
            document.getElementById('stores-nav').style.display = 'block';
            // 初回ログイン時に店舗一覧を読み込み
            if (!this.stores) {
                this.loadStores();
            }
        } else {
            document.getElementById('stores-nav').style.display = 'none';
        }
    }

    setupEventListeners() {
        // Login form
        document.getElementById('login-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        // Register form
        document.getElementById('register-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleRegister();
        });

        // Auth screen switching
        document.getElementById('show-register').addEventListener('click', () => {
            this.showRegisterScreen();
        });

        document.getElementById('show-login').addEventListener('click', () => {
            this.showLoginScreen();
        });

        // Register role change
        document.getElementById('register-role').addEventListener('change', (e) => {
            this.handleRoleChange(e.target.value);
        });

        // Logout
        document.getElementById('logout-btn').addEventListener('click', () => {
            this.handleLogout();
        });

        // Navigation
        document.getElementById('dashboard-tab').addEventListener('click', (e) => {
            e.preventDefault();
            this.showView('dashboard');
            this.loadDashboard();
        });

        document.getElementById('coupons-tab').addEventListener('click', (e) => {
            e.preventDefault();
            this.showView('coupons');
            this.loadCoupons();
        });

        document.getElementById('stores-tab').addEventListener('click', (e) => {
            e.preventDefault();
            this.showView('stores');
            this.loadStores();
        });

        // Quick actions
        document.getElementById('quick-create-coupon').addEventListener('click', async () => {
            await this.showCreateCouponModal();
        });

        document.getElementById('create-coupon-btn').addEventListener('click', async () => {
            await this.showCreateCouponModal();
        });

        document.getElementById('create-store-btn').addEventListener('click', () => {
            this.showCreateStoreModal();
        });

        // Modal controls
        this.setupModalEventListeners();

        // Forms
        this.setupFormEventListeners();

        // Filters
        this.setupFilterEventListeners();
    }

    setupModalEventListeners() {
        // Create coupon modal
        document.getElementById('close-create-coupon').addEventListener('click', () => {
            this.hideCreateCouponModal();
        });

        document.getElementById('cancel-create-coupon').addEventListener('click', () => {
            this.hideCreateCouponModal();
        });

        // Create store modal
        document.getElementById('close-create-store').addEventListener('click', () => {
            this.hideCreateStoreModal();
        });

        document.getElementById('cancel-create-store').addEventListener('click', () => {
            this.hideCreateStoreModal();
        });

        // Coupon users modal
        document.getElementById('close-coupon-users').addEventListener('click', () => {
            this.hideCouponUsersModal();
        });

        // Close modals on backdrop click
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.style.display = 'none';
                }
            });
        });
    }

    setupFormEventListeners() {
        // Create coupon form
        document.getElementById('create-coupon-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleCreateCoupon();
        });

        // Create store form
        document.getElementById('create-store-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleCreateStore();
        });

        // Discount schedule
        document.getElementById('add-schedule').addEventListener('click', () => {
            this.addDiscountScheduleItem();
        });

        // Address geocoding
        document.getElementById('geocode-address').addEventListener('click', () => {
            this.geocodeAddress();
        });

        // Current location
        document.getElementById('get-current-location').addEventListener('click', () => {
            this.getCurrentLocation();
        });

        // Initialize default times
        this.initializeDefaultTimes();
        this.renderDiscountSchedule();
    }

    setupFilterEventListeners() {
        try {
            // Store filter
            const storeFilter = document.getElementById('store-filter');
            if (storeFilter) {
                storeFilter.addEventListener('change', (e) => {
                    try {
                        this.currentFilters.store = e.target.value;
                        this.applyFilters();
                    } catch (error) {
                        console.error('Error applying store filter:', error);
                        this.showErrorNotification('店舗フィルターの適用中にエラーが発生しました');
                    }
                });
            }

            // Status filter
            const statusFilter = document.getElementById('status-filter');
            if (statusFilter) {
                statusFilter.addEventListener('change', (e) => {
                    try {
                        this.currentFilters.status = e.target.value;
                        this.applyFilters();
                    } catch (error) {
                        console.error('Error applying status filter:', error);
                        this.showErrorNotification('ステータスフィルターの適用中にエラーが発生しました');
                    }
                });
            }

            // Reset filters
            const resetButton = document.getElementById('reset-filters');
            if (resetButton) {
                resetButton.addEventListener('click', () => {
                    try {
                        this.resetFilters();
                    } catch (error) {
                        console.error('Error resetting filters:', error);
                        this.showErrorNotification('フィルターのリセット中にエラーが発生しました');
                    }
                });
            }
        } catch (error) {
            console.error('Error setting up filter event listeners:', error);
        }
    }

    initializeDefaultTimes() {
        const now = new Date();
        const defaultEnd = new Date(now.getTime() + 5 * 60 * 1000);
        
        // 日本時間に調整（UTC+9）
        const jstOffset = 9 * 60 * 60 * 1000;
        const nowJST = new Date(now.getTime() + jstOffset);
        const defaultEndJST = new Date(defaultEnd.getTime() + jstOffset);
        
        document.getElementById('start-time').value = nowJST.toISOString().slice(0, 16);
        document.getElementById('end-time').value = defaultEndJST.toISOString().slice(0, 16);
    }

    // Authentication handlers
    async handleLogin() {
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const errorDiv = document.getElementById('login-error');
        const loginBtn = document.getElementById('login-btn');

        loginBtn.textContent = 'ログイン中...';
        loginBtn.disabled = true;
        errorDiv.style.display = 'none';

        try {
            const response = await fetch(`${this.API_BASE_URL}/admin/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'ログインに失敗しました');
            }

            const data = await response.json();
            this.setAdminAuthToken(data.access_token);
            this.admin = data.admin;
            
            if (this.admin.role === 'store_owner') {
                await this.loadStoreInfo();
            }

            this.showAdminApp();
        } catch (error) {
            errorDiv.textContent = error.message;
            errorDiv.style.display = 'block';
        } finally {
            loginBtn.textContent = 'ログイン';
            loginBtn.disabled = false;
        }
    }

    async handleRegister() {
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        const role = document.getElementById('register-role').value;
        const storeId = document.getElementById('register-store').value;
        const registrationCode = document.getElementById('register-code').value;
        
        const errorDiv = document.getElementById('register-error');
        const registerBtn = document.getElementById('register-btn');

        registerBtn.textContent = '登録中...';
        registerBtn.disabled = true;
        errorDiv.style.display = 'none';

        try {
            const requestData = {
                email,
                password,
                role
            };

            if (role === 'store_owner' && storeId) {
                requestData.linked_store_id = storeId;
            }

            if (role === 'super_admin' && registrationCode) {
                requestData.registration_code = registrationCode;
            }

            const response = await fetch(`${this.API_BASE_URL}/admin/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestData)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || '登録に失敗しました');
            }

            const data = await response.json();
            this.setAdminAuthToken(data.access_token);
            this.admin = data.admin;
            
            if (this.admin.role === 'store_owner') {
                await this.loadStoreInfo();
            }

            this.showAdminApp();
            this.showSuccessNotification('アカウントが正常に作成されました！');
        } catch (error) {
            errorDiv.textContent = error.message;
            errorDiv.style.display = 'block';
        } finally {
            registerBtn.textContent = 'アカウント作成';
            registerBtn.disabled = false;
        }
    }

    handleRoleChange(role) {
        const storeGroup = document.getElementById('store-selection-group');
        const codeGroup = document.getElementById('registration-code-group');
        
        if (role === 'store_owner') {
            storeGroup.style.display = 'block';
            codeGroup.style.display = 'none';
        } else if (role === 'super_admin') {
            storeGroup.style.display = 'none';
            codeGroup.style.display = 'block';
        } else {
            storeGroup.style.display = 'none';
            codeGroup.style.display = 'none';
        }
    }

    async loadAvailableStores() {
        try {
            // Load stores for registration (without auth)
            const response = await fetch(`${this.API_BASE_URL}/stores/public`);
            if (response.ok) {
                const stores = await response.json();
                this.populateStoreOptions(stores);
            } else {
                // If public endpoint doesn't exist, use sample data
                this.populateSampleStores();
            }
        } catch (error) {
            console.log('Failed to load stores for registration, using sample data');
            this.populateSampleStores();
        }
    }

    populateSampleStores() {
        // Sample stores for registration (these should match the actual store data)
        const sampleStores = [
            { id: '1', name: '東京駅コーヒーショップ' },
            { id: '2', name: '銀座レストラン' },
            { id: '3', name: '新宿書店' }
        ];
        this.populateStoreOptions(sampleStores);
    }

    populateStoreOptions(stores) {
        const storeSelect = document.getElementById('register-store');
        // Clear existing options except the first one
        while (storeSelect.children.length > 1) {
            storeSelect.removeChild(storeSelect.lastChild);
        }
        
        stores.forEach(store => {
            const option = document.createElement('option');
            option.value = store.id;
            option.textContent = store.name;
            storeSelect.appendChild(option);
        });
    }

    handleLogout() {
        this.removeAdminAuthToken();
        this.admin = null;
        this.store = null;
        document.getElementById('login-form').reset();
        document.getElementById('register-form').reset();
        this.showLoginScreen();
    }

    // View management
    showView(viewName) {
        document.querySelectorAll('.view').forEach(view => {
            view.classList.remove('active');
        });

        document.querySelectorAll('.admin-nav-item').forEach(nav => {
            nav.classList.remove('active');
        });

        document.getElementById(`${viewName}-view`).classList.add('active');
        document.getElementById(`${viewName}-tab`).classList.add('active');
        
        this.currentView = viewName;
    }

    showLoading() {
        document.getElementById('loading-overlay').style.display = 'flex';
    }

    hideLoading() {
        document.getElementById('loading-overlay').style.display = 'none';
    }

    // Dashboard
    async loadDashboard() {
        try {
            const response = await this.adminAuthFetch(`${this.API_BASE_URL}/admin/stats`);
            if (!response.ok) throw new Error('統計情報の取得に失敗しました');
            
            const stats = await response.json();
            this.updateDashboardStats(stats);
            
            document.getElementById('dashboard-error').style.display = 'none';
        } catch (error) {
            this.showError('dashboard-error', error.message);
        }
    }

    updateDashboardStats(stats) {
        document.getElementById('total-stores').textContent = stats.total_stores || 0;
        document.getElementById('total-coupons').textContent = stats.total_coupons || 0;
        document.getElementById('active-coupons').textContent = stats.active_coupons || 0;
        document.getElementById('total-users').textContent = stats.total_users || 0;
        document.getElementById('coupons-obtained-today').textContent = stats.coupons_obtained_today || 0;
    }

    // Coupons management
    async loadCoupons() {
        this.showLoading();
        try {
            // Reset filters when loading coupons
            this.currentFilters = { store: '', status: '' };
            
            // Load stores first if not already loaded (for super admin)
            if (this.admin && this.admin.role === 'super_admin' && (!this.stores || this.stores.length === 0)) {
                await this.loadStores();
            }
            
            const response = await this.adminAuthFetch(`${this.API_BASE_URL}/admin/coupons`);
            if (!response.ok) throw new Error('クーポン一覧の取得に失敗しました');
            
            this.coupons = await response.json();
            console.log('Raw coupons loaded:', this.coupons); // デバッグ用
            
            // Add store information to coupons if missing
            this.enrichCouponsWithStoreInfo();
            
            this.populateStoreFilter();
            this.resetFilters(); // Reset UI filters too
            
            document.getElementById('coupons-error').style.display = 'none';
        } catch (error) {
            this.showError('coupons-error', error.message);
        } finally {
            this.hideLoading();
        }
    }

    enrichCouponsWithStoreInfo() {
        if (!this.stores || this.stores.length === 0) {
            console.log('No stores available for enrichment'); // デバッグ用
            return;
        }

        this.coupons = this.coupons.map(coupon => {
            // Normalize coupon data structure
            const normalizedCoupon = {
                ...coupon,
                store_id: coupon.store_id || coupon.storeId,
                active_status: coupon.active_status || coupon.status || this.calculateCouponStatus(coupon)
            };

            // If coupon already has store_name, keep it but ensure store_id is consistent
            if (normalizedCoupon.store_name && normalizedCoupon.store_id) {
                return normalizedCoupon;
            }

            // Find store information from stores array
            const storeId = normalizedCoupon.store_id;
            const store = this.stores.find(s => String(s.id) === String(storeId));
            
            if (store) {
                return {
                    ...normalizedCoupon,
                    store_name: store.name,
                    store_id: String(store.id) // Ensure string consistency
                };
            }
            
            // If no store found, at least provide a fallback
            return {
                ...normalizedCoupon,
                store_name: normalizedCoupon.store_name || `店舗 ${storeId || 'unknown'}`,
                store_id: String(storeId || '')
            };
        });

        console.log('Enriched coupons with store info:', this.coupons); // デバッグ用
    }

    populateStoreFilter() {
        const storeFilter = document.getElementById('store-filter');
        if (!storeFilter) {
            console.error('Store filter element not found');
            return;
        }
        
        const currentValue = storeFilter.value;
        
        // Clear existing options except "all stores"
        while (storeFilter.children.length > 1) {
            storeFilter.removeChild(storeFilter.lastChild);
        }

        console.log('Populating store filter with coupons:', this.coupons); // デバッグ用

        // Get unique stores from coupons (primary source)
        const uniqueStores = new Map();
        
        // First, try to get stores from coupon data
        if (this.coupons && this.coupons.length > 0) {
            this.coupons.forEach(coupon => {
                const storeId = coupon.store_id;
                const storeName = coupon.store_name;
                
                if (storeId && storeName) {
                    uniqueStores.set(String(storeId), storeName);
                }
            });
        }

        // If no stores found from coupons, use the stores array as fallback
        if (uniqueStores.size === 0 && this.stores && this.stores.length > 0) {
            console.log('Using stores from this.stores as fallback:', this.stores); // デバッグ用
            this.stores.forEach(store => {
                uniqueStores.set(String(store.id), store.name);
            });
        }

        console.log('Unique stores found for filter:', uniqueStores); // デバッグ用

        // Add store options
        uniqueStores.forEach((storeName, storeId) => {
            const option = document.createElement('option');
            option.value = storeId;
            option.textContent = storeName;
            storeFilter.appendChild(option);
        });

        // Restore previous selection if valid
        if (currentValue && Array.from(storeFilter.options).some(option => option.value === currentValue)) {
            storeFilter.value = currentValue;
        }
        
        console.log('Store filter populated with', uniqueStores.size, 'options'); // デバッグ用
    }

    applyFilters() {
        try {
            console.log('Applying filters:', this.currentFilters); // デバッグ用
            
            // Ensure coupons array exists
            if (!this.coupons || !Array.isArray(this.coupons)) {
                console.warn('No coupons available for filtering');
                this.filteredCoupons = [];
                this.renderCoupons();
                this.updateFilterCount();
                return;
            }
            
            console.log('Total coupons before filtering:', this.coupons.length); // デバッグ用
            
            let filtered = [...this.coupons];

            // Apply store filter
            if (this.currentFilters.store && this.currentFilters.store.trim() !== '') {
                console.log('Filtering by store:', this.currentFilters.store); // デバッグ用
                filtered = filtered.filter(coupon => {
                    try {
                        const storeId = coupon.store_id;
                        // Convert both to strings for comparison and handle null/undefined
                        const couponStoreId = String(storeId || '');
                        const filterStoreId = String(this.currentFilters.store || '');
                        const matches = couponStoreId === filterStoreId;
                        console.log('Coupon store ID:', couponStoreId, 'Filter value:', filterStoreId, 'Matches:', matches); // デバッグ用
                        return matches;
                    } catch (error) {
                        console.error('Error filtering coupon by store:', error, coupon);
                        return false; // Exclude invalid coupons
                    }
                });
                console.log('After store filter:', filtered.length); // デバッグ用
            }

            // Apply status filter
            if (this.currentFilters.status && this.currentFilters.status.trim() !== '') {
                console.log('Filtering by status:', this.currentFilters.status); // デバッグ用
                filtered = filtered.filter(coupon => {
                    try {
                        const status = coupon.active_status || this.calculateCouponStatus(coupon);
                        const matches = status === this.currentFilters.status;
                        console.log('Coupon status:', status, 'Expected:', this.currentFilters.status, 'Matches:', matches); // デバッグ用
                        return matches;
                    } catch (error) {
                        console.error('Error filtering coupon by status:', error, coupon);
                        return false; // Exclude invalid coupons
                    }
                });
                console.log('After status filter:', filtered.length); // デバッグ用
            }

            this.filteredCoupons = filtered;
            console.log('Final filtered coupons:', filtered.length); // デバッグ用
            this.renderCoupons();
            this.updateFilterCount();
        } catch (error) {
            console.error('Error in applyFilters:', error);
            this.showErrorNotification('フィルターの適用中にエラーが発生しました');
            // Fallback: show all coupons
            this.filteredCoupons = this.coupons || [];
            this.renderCoupons();
            this.updateFilterCount();
        }
    }

    resetFilters() {
        try {
            this.currentFilters = {
                store: '',
                status: ''
            };
            
            // Reset filter UI elements safely
            const storeFilter = document.getElementById('store-filter');
            if (storeFilter) {
                storeFilter.value = '';
            }
            
            const statusFilter = document.getElementById('status-filter');
            if (statusFilter) {
                statusFilter.value = '';
            }
            
            this.applyFilters();
            console.log('Filters reset successfully');
        } catch (error) {
            console.error('Error resetting filters:', error);
            this.showErrorNotification('フィルターのリセット中にエラーが発生しました');
        }
    }

    updateFilterCount() {
        try {
            const countElement = document.getElementById('filter-count');
            if (!countElement) {
                console.warn('Filter count element not found');
                return;
            }
            
            const totalCount = (this.coupons && Array.isArray(this.coupons)) ? this.coupons.length : 0;
            const filteredCount = (this.filteredCoupons && Array.isArray(this.filteredCoupons)) ? this.filteredCoupons.length : 0;
            
            if (totalCount === filteredCount) {
                countElement.textContent = `${totalCount} 件のクーポン`;
            } else {
                countElement.textContent = `${filteredCount} / ${totalCount} 件のクーポン`;
            }
            
            console.log('Filter count updated:', { totalCount, filteredCount });
        } catch (error) {
            console.error('Error updating filter count:', error);
        }
    }

    renderCoupons() {
        const container = document.getElementById('coupons-grid');
        const couponsToRender = this.filteredCoupons || this.coupons;
        
        if (this.coupons.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>まだクーポンがありません</p>
                    <button onclick="adminApp.showCreateCouponModal()">最初のクーポンを作成</button>
                </div>
            `;
            return;
        }

        if (couponsToRender.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>フィルター条件に一致するクーポンがありません</p>
                    <button onclick="adminApp.resetFilters()">フィルターをリセット</button>
                </div>
            `;
            return;
        }

        container.innerHTML = couponsToRender.map(coupon => {
            const status = coupon.active_status || this.calculateCouponStatus(coupon);
            const storeName = coupon.store_name || `店舗 ${coupon.store_id || 'unknown'}`;
            
            return `
            <div class="coupon-card">
                <div class="coupon-header">
                    <h3>${this.escapeHtml(coupon.title)}</h3>
                    <div class="coupon-meta">
                        <span class="coupon-store">${this.escapeHtml(storeName)}</span>
                        <span class="coupon-status" style="color: ${this.getStatusColor(status)}">
                            ${this.getStatusText(status)}
                        </span>
                    </div>
                </div>
                
                <div class="coupon-content">
                    <p class="coupon-description">${this.escapeHtml(coupon.description || '')}</p>
                    <div class="coupon-details">
                        <div class="detail-row">
                            <div class="detail-item">
                                <span class="detail-label">初期割引率:</span>
                                <span class="detail-value">${coupon.discount_rate_initial}%</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">現在割引率:</span>
                                <span class="detail-value discount-highlight">${coupon.current_discount || coupon.discount_rate_initial}%</span>
                            </div>
                        </div>
                        <div class="detail-row">
                            <div class="detail-item">
                                <span class="detail-label">開始時間:</span>
                                <span class="detail-value">${this.formatDateTime(coupon.start_time)}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">終了時間:</span>
                                <span class="detail-value">${this.formatDateTime(coupon.end_time)}</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="coupon-actions">
                    <button onclick="adminApp.viewCouponUsers('${coupon.id}')" class="action-btn primary">
                        📊 利用者を見る
                    </button>
                    <button onclick="adminApp.duplicateCoupon('${coupon.id}')" class="action-btn secondary">
                        📋 複製
                    </button>
                    ${this.admin && this.admin.role === 'super_admin' ? `
                    <button onclick="adminApp.deleteCoupon('${coupon.id}', true)" class="action-btn danger">
                        🗑️ 削除
                    </button>
                    ` : ''}
                </div>
            </div>`
        }).join('');
    }

    // Store management (Super Admin only)
    async loadStores() {
        // Skip loading overlay if called from loadCoupons
        const calledFromCoupons = new Error().stack.includes('loadCoupons');
        
        if (!calledFromCoupons) {
            this.showLoading();
        }
        
        try {
            const response = await this.adminAuthFetch(`${this.API_BASE_URL}/admin/stores`);
            if (!response.ok) throw new Error('店舗一覧の取得に失敗しました');
            
            this.stores = await response.json();
            console.log('Loaded stores:', this.stores); // デバッグ用
            
            // Only render stores if we're in stores view
            if (this.currentView === 'stores') {
                this.renderStores();
            }
            
            document.getElementById('stores-error').style.display = 'none';
        } catch (error) {
            console.error('Failed to load stores:', error); // デバッグ用
            if (this.currentView === 'stores') {
                this.showError('stores-error', error.message);
            }
            // For store owners, try to get their own store info
            if (this.admin && this.admin.role === 'store_owner' && this.store) {
                this.stores = [this.store];
                console.log('Using store owner\'s store:', this.stores); // デバッグ用
            }
        } finally {
            if (!calledFromCoupons) {
                this.hideLoading();
            }
        }
    }

    renderStores() {
        const container = document.getElementById('stores-grid');
        
        if (this.stores.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>まだ店舗がありません</p>
                    <button onclick="adminApp.showCreateStoreModal()">最初の店舗を追加</button>
                </div>
            `;
            return;
        }

        container.innerHTML = this.stores.map(store => `
            <div class="store-card">
                <div class="store-header">
                    <h3>${this.escapeHtml(store.name)}</h3>
                    <div class="store-meta">
                        <span class="store-owner">${this.escapeHtml(store.owner_email)}</span>
                        <span class="store-status ${store.is_active ? 'active' : 'inactive'}">
                            ${store.is_active ? 'アクティブ' : '非アクティブ'}
                        </span>
                    </div>
                </div>
                
                <div class="store-content">
                    <p class="store-description">${this.escapeHtml(store.description || '説明なし')}</p>
                    <div class="store-details">
                        <div class="detail-row">
                            <div class="detail-item">
                                <span class="detail-label">住所</span>
                                <span class="detail-value">${this.escapeHtml(store.address || '未設定')}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">作成日</span>
                                <span class="detail-value">${this.formatDateTime(store.created_at)}</span>
                            </div>
                        </div>
                        <div class="detail-row">
                            <div class="detail-item">
                                <span class="detail-label">緯度</span>
                                <span class="detail-value">${store.latitude.toFixed(6)}</span>
                            </div>
                            <div class="detail-item">
                                <span class="detail-label">経度</span>
                                <span class="detail-value">${store.longitude.toFixed(6)}</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="store-actions">
                    <button class="action-btn secondary">🗺️ 地図で表示</button>
                    <button class="action-btn secondary">✏️ 編集</button>
                    <button onclick="adminApp.deleteStore('${store.id}', true)" class="action-btn danger">
                        🗑️ 削除
                    </button>
                </div>
            </div>
        `).join('');
    }

    // Modal management
    async showCreateCouponModal() {
        // 最新の管理者情報を取得
        await this.refreshAdminInfo();
        
        // スーパー管理者の場合は利用可能な店舗をチェック
        if (this.admin.role === 'super_admin') {
            // 利用可能な店舗があるかチェック
            if (!this.stores || this.stores.length === 0) {
                await this.loadStores(); // 店舗一覧を再読み込み
            }
            
            if (!this.stores || this.stores.length === 0) {
                this.showWarningNotification('クーポンを作成するには、まず店舗を作成してください。「店舗管理」タブから新しい店舗を追加できます。', 6000);
                return;
            }
            
            // 店舗選択フィールドを表示して設定
            this.setupStoreSelector();
        } else {
            // 店舗オーナーの場合は自分の店舗をチェック
            if (!this.admin.linked_store_id && !this.store) {
                this.showWarningNotification('クーポンを作成するには、まず店舗を作成してください。「店舗管理」タブから新しい店舗を追加できます。', 6000);
                return;
            }
            // 店舗選択フィールドを隠す
            document.getElementById('store-select-group').style.display = 'none';
        }
        
        console.log('Creating coupon for admin:', this.admin); // デバッグ用
        console.log('Store info:', this.store); // デバッグ用
        console.log('Available stores:', this.stores); // デバッグ用
        
        this.initializeDefaultTimes();
        this.renderDiscountSchedule();
        document.getElementById('create-coupon-modal').style.display = 'flex';
    }

    setupStoreSelector() {
        const storeSelectGroup = document.getElementById('store-select-group');
        const storeSelect = document.getElementById('coupon-store');
        
        // 店舗選択フィールドを表示
        storeSelectGroup.style.display = 'block';
        
        // 既存のオプションをクリア
        storeSelect.innerHTML = '<option value="">店舗を選択してください</option>';
        
        // 利用可能な店舗をオプションに追加
        this.stores.forEach(store => {
            const option = document.createElement('option');
            option.value = store.id;
            option.textContent = `${store.name} (${store.address || '住所未設定'})`;
            storeSelect.appendChild(option);
        });
        
        // 最初の店舗を自動選択
        if (this.stores.length > 0) {
            storeSelect.value = this.stores[0].id;
        }
    }

    hideCreateCouponModal() {
        document.getElementById('create-coupon-modal').style.display = 'none';
        document.getElementById('create-coupon-form').reset();
        // 店舗選択フィールドを隠す
        document.getElementById('store-select-group').style.display = 'none';
    }

    showCreateStoreModal() {
        if (this.admin.role !== 'super_admin') return;
        document.getElementById('create-store-modal').style.display = 'flex';
    }

    hideCreateStoreModal() {
        document.getElementById('create-store-modal').style.display = 'none';
        document.getElementById('create-store-form').reset();
    }

    async viewCouponUsers(couponId) {
        try {
            console.log('Fetching users for coupon ID:', couponId); // デバッグ追加
            const response = await this.adminAuthFetch(`${this.API_BASE_URL}/admin/coupons/${couponId}/users`);
            console.log('API response status:', response.status); // デバッグ追加
            
            if (!response.ok) throw new Error('利用者情報の取得に失敗しました');
            
            const users = await response.json();
            console.log('API response users:', users); // デバッグ追加
            const coupon = this.coupons.find(c => c.id === couponId);
            
            document.getElementById('coupon-users-title').textContent = `${coupon?.title} の利用者`;
            
            const container = document.getElementById('users-table-container');
            
            if (users.length === 0) {
                container.innerHTML = '<p>このクーポンはまだ誰にも取得されていません</p>';
            } else {
                container.innerHTML = `
                    <table class="users-table">
                        <thead>
                            <tr>
                                <th>ユーザー名</th>
                                <th>メール</th>
                                <th>割引率</th>
                                <th>取得日時</th>
                                <th>ステータス</th>
                                <th>使用日時</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${users.map(user => `
                                <tr>
                                    <td>${this.escapeHtml(user.user_name)}</td>
                                    <td>${this.escapeHtml(user.user_email)}</td>
                                    <td>${user.discount}%</td>
                                    <td>${this.formatDateTime(user.obtained_at)}</td>
                                    <td>
                                        <span class="status-badge ${user.status}">
                                            ${user.status === 'used' ? '使用済み' : 
                                              user.status === 'obtained' ? '取得済み' : '期限切れ'}
                                        </span>
                                    </td>
                                    <td>${user.used_at ? this.formatDateTime(user.used_at) : '-'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                `;
            }
            
            document.getElementById('coupon-users-modal').style.display = 'flex';
        } catch (error) {
            this.showErrorNotification(error.message);
        }
    }

    hideCouponUsersModal() {
        document.getElementById('coupon-users-modal').style.display = 'none';
    }

    // Form handlers
    async handleCreateCoupon() {
        try {
            const formData = this.getCouponFormData();
            console.log('Sending coupon data:', formData); // デバッグ用
            
            const response = await this.adminAuthFetch(`${this.API_BASE_URL}/admin/coupons`, {
                method: 'POST',
                body: JSON.stringify(formData)
            });

            if (!response.ok) {
                let errorMessage = 'クーポンの作成に失敗しました';
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.detail || errorData.message || errorMessage;
                    console.error('Server error:', errorData); // デバッグ用
                } catch (jsonError) {
                    console.error('Failed to parse error response:', jsonError);
                    errorMessage = `サーバーエラー (${response.status}): ${response.statusText}`;
                }
                throw new Error(errorMessage);
            }

            const result = await response.json();
            console.log('Coupon created successfully:', result); // デバッグ用

            this.hideCreateCouponModal();
            this.loadCoupons();
            this.showSuccessNotification('クーポンを作成しました！');
        } catch (error) {
            console.error('Coupon creation error:', error); // デバッグ用
            let errorMessage = '予期しないエラーが発生しました';
            
            if (error instanceof Error) {
                errorMessage = error.message;
            } else if (typeof error === 'string') {
                errorMessage = error;
            } else {
                errorMessage = 'ネットワークエラーまたは接続問題が発生しました';
            }
            
            this.showErrorNotification(errorMessage);
        }
    }

    async handleCreateStore() {
        const formData = this.getStoreFormData();
        
        try {
            console.log('Sending store data:', formData); // デバッグ用
            const response = await this.adminAuthFetch(`${this.API_BASE_URL}/admin/stores`, {
                method: 'POST',
                body: JSON.stringify(formData)
            });

            if (!response.ok) {
                let errorMessage = '店舗の作成に失敗しました';
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.detail || errorData.message || errorMessage;
                    console.error('Server error:', errorData); // デバッグ用
                } catch (jsonError) {
                    console.error('Failed to parse error response:', jsonError);
                    errorMessage = `サーバーエラー (${response.status}): ${response.statusText}`;
                }
                throw new Error(errorMessage);
            }

            const result = await response.json();
            console.log('Store created successfully:', result); // デバッグ用
            
            // 管理者情報を再取得して更新
            await this.refreshAdminInfo();
            
            this.hideCreateStoreModal();
            this.loadStores();
            this.showSuccessNotification('店舗を作成しました！');
        } catch (error) {
            console.error('Store creation error:', error); // デバッグ用
            let errorMessage = '予期しないエラーが発生しました';
            
            if (error instanceof Error) {
                errorMessage = error.message;
            } else if (typeof error === 'string') {
                errorMessage = error;
            } else {
                errorMessage = 'ネットワークエラーまたは接続問題が発生しました';
            }
            
            this.showErrorNotification(errorMessage);
        }
    }

    getCouponFormData() {
        // 店舗オーナーの場合は自分の店舗ID、スーパー管理者の場合は選択された店舗ID
        let storeId = null;
        if (this.admin.role === 'store_owner') {
            storeId = this.admin.linked_store_id || this.store?.id;
        } else if (this.admin.role === 'super_admin') {
            // スーパー管理者の場合は選択された店舗IDを使用
            const storeSelect = document.getElementById('coupon-store');
            storeId = storeSelect ? storeSelect.value : null;
            
            // フォールバックとして最初の利用可能な店舗を使用
            if (!storeId && this.stores && this.stores.length > 0) {
                storeId = this.stores[0].id;
            }
        }

        console.log('Getting coupon form data - storeId:', storeId); // デバッグ用
        console.log('Admin role:', this.admin.role); // デバッグ用
        console.log('Selected store from form:', document.getElementById('coupon-store')?.value); // デバッグ用
        console.log('Available stores:', this.stores); // デバッグ用

        if (!storeId) {
            throw new Error('店舗を選択してください。店舗が存在しない場合は、まず店舗を作成してください。');
        }

        return {
            store_id: storeId,
            title: document.getElementById('coupon-title').value,
            description: document.getElementById('coupon-description').value,
            discount_rate_initial: parseInt(document.getElementById('discount-initial').value),
            start_time: document.getElementById('start-time').value,
            end_time: document.getElementById('end-time').value,
            discount_rate_schedule: this.discountSchedule
        };
    }

    getStoreFormData() {
        // フォーム要素の取得と存在チェック
        const nameElement = document.getElementById('store-name');
        const descriptionElement = document.getElementById('store-description');
        const latitudeElement = document.getElementById('store-latitude');
        const longitudeElement = document.getElementById('store-longitude');
        const addressElement = document.getElementById('store-address');

        if (!nameElement || !latitudeElement || !longitudeElement) {
            throw new Error('フォーム要素が見つかりません。ページを再読み込みしてください。');
        }

        const name = nameElement.value ? nameElement.value.trim() : '';
        const description = descriptionElement && descriptionElement.value ? descriptionElement.value.trim() : '';
        const latitudeValue = latitudeElement.value || '';
        const longitudeValue = longitudeElement.value || '';
        const address = addressElement && addressElement.value ? addressElement.value.trim() : '';

        console.log('Form values:', { name, description, latitudeValue, longitudeValue, address }); // デバッグ用

        // バリデーション
        if (!name) {
            throw new Error('店舗名を入力してください');
        }

        const latitude = parseFloat(latitudeValue);
        const longitude = parseFloat(longitudeValue);

        if (isNaN(latitude) || isNaN(longitude)) {
            throw new Error('緯度と経度は数値で入力してください');
        }

        if (latitude < -90 || latitude > 90) {
            throw new Error('緯度は-90から90の間で入力してください');
        }

        if (longitude < -180 || longitude > 180) {
            throw new Error('経度は-180から180の間で入力してください');
        }

        return {
            name,
            description: description || null,
            latitude,
            longitude,
            address: address || null
        };
    }

    // Discount schedule management
    renderDiscountSchedule() {
        const container = document.getElementById('discount-schedule');
        container.innerHTML = this.discountSchedule.map((schedule, index) => `
            <div class="schedule-item">
                <input type="number" min="1" value="${schedule.time_remain_min}" 
                       onchange="adminApp.updateScheduleItem(${index}, 'time_remain_min', this.value)">
                <span>分前に</span>
                <input type="number" min="1" max="100" value="${schedule.rate}"
                       onchange="adminApp.updateScheduleItem(${index}, 'rate', this.value)">
                <span>%割引</span>
                <button type="button" class="remove-schedule-btn" 
                        onclick="adminApp.removeScheduleItem(${index})">削除</button>
            </div>
        `).join('');
    }

    addDiscountScheduleItem() {
        this.discountSchedule.push({ time_remain_min: 15, rate: 25 });
        this.renderDiscountSchedule();
    }

    removeScheduleItem(index) {
        this.discountSchedule.splice(index, 1);
        this.renderDiscountSchedule();
    }

    updateScheduleItem(index, field, value) {
        this.discountSchedule[index][field] = parseInt(value);
    }

    // Store actions
    async deleteStore(storeId, hardDelete = false) {
        try {
            // Check if user has permission to delete this store
            if (this.admin.role === 'store_owner') {
                const linkedStoreId = this.admin.linked_store_id || this.store?.id;
                if (linkedStoreId !== storeId) {
                    this.showErrorNotification('この店舗を削除する権限がありません。自分の店舗のみ削除できます。');
                    return;
                }
            }
            
            let store = null;
            let relatedData = null;
            
            // Try to get store deletion info, but fallback if not available
            try {
                const infoResponse = await this.adminAuthFetch(`${this.API_BASE_URL}/admin/stores/info/${storeId}`);
                if (infoResponse.ok) {
                    const storeInfo = await infoResponse.json();
                    store = storeInfo.store;
                    relatedData = storeInfo.related_data;
                } else if (infoResponse.status === 404) {
                    this.showErrorNotification('店舗が見つからないか、削除する権限がありません。');
                    return;
                }
            } catch (infoError) {
                console.warn('Could not fetch store deletion info, proceeding with basic confirmation:', infoError);
                // Fallback: find store from current stores list
                if (this.stores && this.stores.length > 0) {
                    store = this.stores.find(s => s.id === storeId);
                }
            }
            
            // Prepare confirmation message with available information
            const storeName = store ? store.name : `店舗 ID: ${storeId}`;
            let confirmMessage = `店舗「${storeName}」を削除しますか？`;
            let warningMessage = '';
            
            if (hardDelete) {
                confirmMessage = `店舗「${storeName}」を完全削除しますか？\n\nこの操作は取り消せません。`;
                if (relatedData && relatedData.admin_count > 0) {
                    warningMessage = `\n注意: ${relatedData.admin_count}個の管理者アカウントから店舗リンクが解除されます。`;
                } else {
                    warningMessage = `\n注意: 関連する管理者アカウントとクーポンにも影響があります。`;
                }
            } else {
                if (relatedData && relatedData.coupon_count > 0) {
                    warningMessage = `\n注意: 関連する${relatedData.coupon_count}件のクーポンも無効化されます。`;
                } else {
                    warningMessage = `\n注意: 関連するクーポンも無効化される可能性があります。`;
                }
            }
            
            const fullMessage = confirmMessage + warningMessage;
            
            const confirmed = await this.showConfirmModal({
                title: hardDelete ? '完全削除の確認' : '削除の確認',
                message: fullMessage,
                cancelText: 'キャンセル',
                okText: hardDelete ? '完全削除' : '削除',
                danger: true
            });
            
            if (!confirmed) return;
            
            // Perform deletion
            this.showLoading();
            const deleteResponse = await this.adminAuthFetch(
                `${this.API_BASE_URL}/admin/stores/${storeId}${hardDelete ? '?hard_delete=true' : ''}`,
                { method: 'DELETE' }
            );
            
            if (!deleteResponse.ok) {
                const errorData = await deleteResponse.json().catch(() => ({ detail: '不明なエラー' }));
                if (deleteResponse.status === 404) {
                    throw new Error('店舗が見つからないか、削除する権限がありません。');
                } else if (deleteResponse.status === 403) {
                    throw new Error('この操作を実行する権限がありません。');
                } else {
                    throw new Error(errorData.detail || '店舗の削除に失敗しました');
                }
            }
            
            const result = await deleteResponse.json().catch(() => ({ message: '店舗を削除しました' }));
            
            // Show success message
            this.showSuccessNotification(result.message || '店舗を削除しました');
            
            // Refresh stores list
            await this.loadStores();
            
            // If current admin deleted their own store, refresh admin info
            if (this.admin.role === 'store_owner' && this.admin.linked_store_id === storeId) {
                await this.refreshAdminInfo();
            }
            
        } catch (error) {
            console.error('Store deletion error:', error);
            this.showErrorNotification(error.message || '店舗の削除中にエラーが発生しました');
        } finally {
            this.hideLoading();
        }
    }

    // Coupon actions
    async duplicateCoupon(couponId) {
        const coupon = this.coupons.find(c => c.id === couponId);
        if (!coupon) {
            this.showErrorNotification('クーポンが見つかりません');
            return;
        }

        try {
            const now = new Date();
            const defaultEnd = new Date(now.getTime() + 5 * 60 * 1000);
            
            // 日本時間に調整（UTC+9）
            const jstOffset = 9 * 60 * 60 * 1000;
            const nowJST = new Date(now.getTime() + jstOffset);
            const defaultEndJST = new Date(defaultEnd.getTime() + jstOffset);

            // 基本情報をコピー
            document.getElementById('coupon-title').value = `${coupon.title} (コピー)`;
            document.getElementById('coupon-description').value = coupon.description || '';
            document.getElementById('discount-initial').value = coupon.discount_rate_initial;
            document.getElementById('start-time').value = nowJST.toISOString().slice(0, 16);
            document.getElementById('end-time').value = defaultEndJST.toISOString().slice(0, 16);

            // 割引スケジュールをコピー
            if (coupon.discount_rate_schedule) {
                this.discountSchedule = JSON.parse(JSON.stringify(coupon.discount_rate_schedule));
            } else {
                this.discountSchedule = [];
            }
            this.renderDiscountSchedule();

            // まずモーダルを表示（店舗セレクターが初期化される）
            await this.showCreateCouponModal();
            
            // モーダル初期化後に店舗選択を設定
            if (this.admin && this.admin.role === 'super_admin' && coupon.store_id) {
                const storeSelect = document.getElementById('coupon-store');
                if (storeSelect) {
                    storeSelect.value = coupon.store_id;
                }
            }

            this.showSuccessNotification('クーポン情報をコピーしました');
        } catch (error) {
            console.error('Duplicate coupon error:', error);
            this.showErrorNotification('クーポンの複製に失敗しました');
        }
    }

    async deleteCoupon(couponId, hardDelete = false) {
        const deleteType = hardDelete ? '完全削除' : '削除';
        const confirmMessage = hardDelete ? 
            'このクーポンを完全削除しますか？\n（データベースから完全に削除され、復元できません）' : 
            'このクーポンを削除しますか？';
            
        const confirmed = await this.showDeleteConfirm(confirmMessage);
        if (!confirmed) return;

        try {
            const url = hardDelete ? 
                `${this.API_BASE_URL}/admin/coupons/${couponId}?hard_delete=true` :
                `${this.API_BASE_URL}/admin/coupons/${couponId}`;
                
            const response = await this.adminAuthFetch(url, {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || `クーポンの${deleteType}に失敗しました`);
            }

            this.loadCoupons();
            const successMessage = hardDelete ? 
                'クーポンを完全削除しました' : 
                'クーポンを削除しました';
            this.showSuccessNotification(successMessage);
        } catch (error) {
            this.showErrorNotification(error.message);
        }
    }

    // Location helpers
    async geocodeAddress() {
        const address = document.getElementById('store-address').value;
        if (!address) {
            this.showWarningNotification('住所を入力してください');
            return;
        }

        try {
            // Nominatim API (OpenStreetMap) を使用して無料でジオコーディング
            const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&countrycodes=jp&limit=1`;
            
            const response = await fetch(url);
            const data = await response.json();
            
            if (data && data.length > 0) {
                const result = data[0];
                document.getElementById('store-latitude').value = parseFloat(result.lat).toFixed(6);
                document.getElementById('store-longitude').value = parseFloat(result.lon).toFixed(6);
                this.showSuccessNotification(`住所から緯度経度を取得しました！ 緯度: ${result.lat}, 経度: ${result.lon}`);
            } else {
                this.showErrorNotification('住所から緯度経度を取得できませんでした。手動で入力してください。');
            }
        } catch (error) {
            console.error('Geocoding error:', error);
            this.showErrorNotification('住所の検索中にエラーが発生しました。手動で緯度経度を入力してください。');
        }
    }

    getCurrentLocation() {
        if (!navigator.geolocation) {
            this.showWarningNotification('お使いのブラウザは位置情報をサポートしていません');
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                document.getElementById('store-latitude').value = position.coords.latitude;
                document.getElementById('store-longitude').value = position.coords.longitude;
                this.showSuccessNotification('現在位置を取得しました！');
            },
            () => {
                this.showErrorNotification('位置情報の取得に失敗しました');
            }
        );
    }

    // Coupon status calculation
    calculateCouponStatus(coupon) {
        if (!coupon.end_time) {
            return 'active'; // Default if no end time
        }
        
        const now = new Date();
        const endTime = new Date(coupon.end_time);
        
        if (now > endTime) {
            // Check if exploded (additional logic could be added here)
            return coupon.exploded ? 'exploded' : 'expired';
        }
        
        return 'active';
    }

    // Utility methods
    formatDateTime(dateString) {
        return new Date(dateString).toLocaleString('ja-JP');
    }

    getStatusColor(status) {
        switch (status) {
            case 'active': return '#4caf50';
            case 'expired': return '#f44336';
            case 'exploded': return '#ff9800';
            default: return '#666';
        }
    }

    getStatusText(status) {
        switch (status) {
            case 'active': return 'アクティブ';
            case 'expired': return '期限切れ';
            case 'exploded': return '爆発済み';
            default: return status;
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showError(elementId, message) {
        const errorElement = document.getElementById(elementId);
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    }
}

// Initialize the app
const adminApp = new AdminApp();