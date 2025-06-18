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
        this.init();
    }

    init() {
        this.checkAuthStatus();
        this.setupEventListeners();
        this.loadAvailableStores();
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
            document.getElementById('store-name').textContent = this.store.name;
        }

        document.getElementById('welcome-message').textContent = 
            `ようこそ、${this.admin.role === 'store_owner' ? this.store?.name : 'スーパー管理者'}さん`;

        // Show store management for super admin
        if (this.admin.role === 'super_admin') {
            document.getElementById('stores-nav').style.display = 'block';
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
        document.getElementById('quick-create-coupon').addEventListener('click', () => {
            this.showCreateCouponModal();
        });

        document.getElementById('create-coupon-btn').addEventListener('click', () => {
            this.showCreateCouponModal();
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
        const defaultEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        
        document.getElementById('start-time').value = now.toISOString().slice(0, 16);
        document.getElementById('end-time').value = defaultEnd.toISOString().slice(0, 16);
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
            alert('アカウントが正常に作成されました！');
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
    showCreateCouponModal() {
        // Check if admin has a linked store
        if (!this.admin.linked_store_id) {
            alert('クーポンを作成するには、まず店舗を作成してください。\n「店舗管理」タブから新しい店舗を追加できます。');
            return;
        }
        
        this.initializeDefaultTimes();
        this.renderDiscountSchedule();
        document.getElementById('create-coupon-modal').style.display = 'flex';
    }

    hideCreateCouponModal() {
        document.getElementById('create-coupon-modal').style.display = 'none';
        document.getElementById('create-coupon-form').reset();
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
            const response = await this.adminAuthFetch(`${this.API_BASE_URL}/admin/coupons/${couponId}/users`);
            if (!response.ok) throw new Error('利用者情報の取得に失敗しました');
            
            const users = await response.json();
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
            alert(error.message);
        }
    }

    hideCouponUsersModal() {
        document.getElementById('coupon-users-modal').style.display = 'none';
    }

    // Form handlers
    async handleCreateCoupon() {
        const formData = this.getCouponFormData();
        
        try {
            const response = await this.adminAuthFetch(`${this.API_BASE_URL}/admin/coupons`, {
                method: 'POST',
                body: JSON.stringify(formData)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'クーポンの作成に失敗しました');
            }

            this.hideCreateCouponModal();
            this.loadCoupons();
            alert('クーポンを作成しました！');
        } catch (error) {
            alert(error.message);
        }
    }

    async handleCreateStore() {
        const formData = this.getStoreFormData();
        
        try {
            const response = await this.adminAuthFetch(`${this.API_BASE_URL}/admin/stores`, {
                method: 'POST',
                body: JSON.stringify(formData)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || '店舗の作成に失敗しました');
            }

            this.hideCreateStoreModal();
            this.loadStores();
            alert('店舗を作成しました！');
        } catch (error) {
            alert(error.message);
        }
    }

    getCouponFormData() {
        // 店舗オーナーの場合は自分の店舗ID、スーパー管理者の場合はフォームから選択
        let storeId = null;
        if (this.admin.role === 'store_owner') {
            storeId = this.admin.linked_store_id;
        } else {
            // スーパー管理者の場合は店舗選択フィールドから取得（将来の実装用）
            storeId = this.store?.id || this.admin.linked_store_id;
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
        return {
            name: document.getElementById('store-name').value,
            description: document.getElementById('store-description').value,
            latitude: parseFloat(document.getElementById('store-latitude').value),
            longitude: parseFloat(document.getElementById('store-longitude').value),
            address: document.getElementById('store-address').value
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
    duplicateCoupon(couponId) {
        const coupon = this.coupons.find(c => c.id === couponId);
        if (!coupon) return;

        const now = new Date();
        const defaultEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000);

        document.getElementById('coupon-title').value = `${coupon.title} (コピー)`;
        document.getElementById('coupon-description').value = coupon.description || '';
        document.getElementById('discount-initial').value = coupon.discount_rate_initial;
        document.getElementById('start-time').value = now.toISOString().slice(0, 16);
        document.getElementById('end-time').value = defaultEnd.toISOString().slice(0, 16);

        this.showCreateCouponModal();
    }

    async deleteCoupon(couponId) {
        if (!confirm('このクーポンを削除しますか？')) return;

        try {
            const response = await this.adminAuthFetch(`${this.API_BASE_URL}/admin/coupons/${couponId}`, {
                method: 'DELETE'
            });
            
            if (!response.ok) throw new Error('クーポンの削除に失敗しました');

            this.loadCoupons();
            alert('クーポンを削除しました');
        } catch (error) {
            alert(error.message);
        }
    }

    // Location helpers
    async geocodeAddress() {
        const address = document.getElementById('store-address').value;
        if (!address) {
            alert('住所を入力してください');
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
                alert(`住所から緯度経度を取得しました！\n緯度: ${result.lat}\n経度: ${result.lon}`);
            } else {
                alert('住所から緯度経度を取得できませんでした。手動で入力してください。');
            }
        } catch (error) {
            console.error('Geocoding error:', error);
            alert('住所の検索中にエラーが発生しました。手動で緯度経度を入力してください。');
        }
    }

    getCurrentLocation() {
        if (!navigator.geolocation) {
            alert('お使いのブラウザは位置情報をサポートしていません');
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                document.getElementById('store-latitude').value = position.coords.latitude;
                document.getElementById('store-longitude').value = position.coords.longitude;
                alert('現在位置を取得しました！');
            },
            (error) => {
                alert('位置情報の取得に失敗しました');
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