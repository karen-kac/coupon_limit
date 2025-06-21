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
            const response = await this.adminAuthFetch(`${this.API_BASE_URL}/admin/coupons`);
            if (!response.ok) throw new Error('クーポン一覧の取得に失敗しました');
            
            this.coupons = await response.json();
            this.renderCoupons();
            
            document.getElementById('coupons-error').style.display = 'none';
        } catch (error) {
            this.showError('coupons-error', error.message);
        } finally {
            this.hideLoading();
        }
    }

    renderCoupons() {
        const container = document.getElementById('coupons-grid');
        
        if (this.coupons.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>まだクーポンがありません</p>
                    <button onclick="adminApp.showCreateCouponModal()">最初のクーポンを作成</button>
                </div>
            `;
            return;
        }

        container.innerHTML = this.coupons.map(coupon => `
            <div class="coupon-card">
                <div class="coupon-header">
                    <h3>${this.escapeHtml(coupon.title)}</h3>
                    <span class="coupon-status" style="color: ${this.getStatusColor(coupon.active_status)}">
                        ${this.getStatusText(coupon.active_status)}
                    </span>
                </div>
                <div class="coupon-content">
                    <p class="coupon-description">${this.escapeHtml(coupon.description || '')}</p>
                    <div class="coupon-details">
                        <div class="detail-item">
                            <strong>初期割引率:</strong> ${coupon.discount_rate_initial}%
                        </div>
                        <div class="detail-item">
                            <strong>現在の割引率:</strong> ${coupon.current_discount}%
                        </div>
                        <div class="detail-item">
                            <strong>開始時間:</strong> ${this.formatDateTime(coupon.start_time)}
                        </div>
                        <div class="detail-item">
                            <strong>終了時間:</strong> ${this.formatDateTime(coupon.end_time)}
                        </div>
                    </div>
                </div>
                <div class="coupon-actions">
                    <button onclick="adminApp.viewCouponUsers('${coupon.id}')" class="view-users-btn">
                        📊 利用者を見る
                    </button>
                    <button onclick="adminApp.duplicateCoupon('${coupon.id}')" class="duplicate-btn">
                        📋 複製
                    </button>
                    <button onclick="adminApp.deleteCoupon('${coupon.id}')" class="delete-btn">
                        🗑️ 削除
                    </button>
                </div>
            </div>
        `).join('');
    }

    // Store management (Super Admin only)
    async loadStores() {
        if (this.admin.role !== 'super_admin') return;
        
        this.showLoading();
        try {
            const response = await this.adminAuthFetch(`${this.API_BASE_URL}/admin/stores`);
            if (!response.ok) throw new Error('店舗一覧の取得に失敗しました');
            
            this.stores = await response.json();
            this.renderStores();
            
            document.getElementById('stores-error').style.display = 'none';
        } catch (error) {
            this.showError('stores-error', error.message);
        } finally {
            this.hideLoading();
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
                    <span class="store-status ${store.is_active ? 'active' : 'inactive'}">
                        ${store.is_active ? 'アクティブ' : '非アクティブ'}
                    </span>
                </div>
                <div class="store-content">
                    <p class="store-description">${this.escapeHtml(store.description || '')}</p>
                    <div class="store-details">
                        <div class="detail-item">
                            <strong>住所:</strong> ${this.escapeHtml(store.address || '未設定')}
                        </div>
                        <div class="detail-item">
                            <strong>オーナー:</strong> ${this.escapeHtml(store.owner_email)}
                        </div>
                        <div class="detail-item">
                            <strong>位置:</strong> ${store.latitude.toFixed(6)}, ${store.longitude.toFixed(6)}
                        </div>
                        <div class="detail-item">
                            <strong>作成日:</strong> ${this.formatDateTime(store.created_at)}
                        </div>
                    </div>
                </div>
                <div class="store-actions">
                    <button class="view-location-btn">🗺️ 地図で表示</button>
                    <button class="edit-btn">✏️ 編集</button>
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

    // Coupon actions
    async duplicateCoupon(couponId) {
        const coupon = this.coupons.find(c => c.id === couponId);
        if (!coupon) return;

        const now = new Date();
        const defaultEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000);

        document.getElementById('coupon-title').value = `${coupon.title} (コピー)`;
        document.getElementById('coupon-description').value = coupon.description || '';
        document.getElementById('discount-initial').value = coupon.discount_rate_initial;
        document.getElementById('start-time').value = now.toISOString().slice(0, 16);
        document.getElementById('end-time').value = defaultEnd.toISOString().slice(0, 16);

        await this.showCreateCouponModal();
    }

    async deleteCoupon(couponId) {
        const confirmed = await this.showDeleteConfirm('このクーポン');
        if (!confirmed) return;

        try {
            const response = await this.adminAuthFetch(`${this.API_BASE_URL}/admin/coupons/${couponId}`, {
                method: 'DELETE'
            });
            
            if (!response.ok) throw new Error('クーポンの削除に失敗しました');

            this.loadCoupons();
            this.showSuccessNotification('クーポンを削除しました');
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