const API_BASE_URL = 'http://localhost:8000/api';

class AdminApp {
    constructor() {
        this.currentView = 'dashboard';
        this.coupons = [];
        this.stats = {};
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.showView('dashboard');
        this.loadDashboard();
    }

    setupEventListeners() {
        // Navigation
        document.getElementById('dashboard-tab').addEventListener('click', () => {
            this.showView('dashboard');
            this.loadDashboard();
        });

        document.getElementById('coupons-tab').addEventListener('click', () => {
            this.showView('coupons');
            this.loadCoupons();
        });

        document.getElementById('create-tab').addEventListener('click', () => {
            this.showView('create');
        });

        // Refresh button
        document.getElementById('refresh-coupons').addEventListener('click', () => {
            this.loadCoupons();
        });

        // Create form
        document.getElementById('create-coupon-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.createCoupon();
        });

        document.getElementById('reset-form').addEventListener('click', () => {
            document.getElementById('create-coupon-form').reset();
        });

        // Edit modal
        document.getElementById('close-edit-modal').addEventListener('click', () => {
            this.closeEditModal();
        });

        document.getElementById('cancel-edit').addEventListener('click', () => {
            this.closeEditModal();
        });

        document.getElementById('edit-coupon-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.updateCoupon();
        });

        // Details modal
        document.getElementById('close-details-modal').addEventListener('click', () => {
            this.closeDetailsModal();
        });

        // Click outside modal to close
        document.getElementById('edit-modal').addEventListener('click', (e) => {
            if (e.target.id === 'edit-modal') {
                this.closeEditModal();
            }
        });

        document.getElementById('details-modal').addEventListener('click', (e) => {
            if (e.target.id === 'details-modal') {
                this.closeDetailsModal();
            }
        });
    }

    showView(viewName) {
        // Hide all views
        document.querySelectorAll('.view').forEach(view => {
            view.classList.remove('active');
        });

        // Remove active class from all nav buttons
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        // Show selected view
        document.getElementById(`${viewName}-view`).classList.add('active');
        document.getElementById(`${viewName}-tab`).classList.add('active');

        this.currentView = viewName;
    }

    async loadDashboard() {
        try {
            const response = await fetch(`${API_BASE_URL}/admin/stats`);
            const stats = await response.json();

            document.getElementById('total-coupons').textContent = stats.total_coupons;
            document.getElementById('active-coupons').textContent = stats.active_coupons;
            document.getElementById('expired-coupons').textContent = stats.expired_coupons;
            document.getElementById('total-obtained').textContent = stats.total_obtained;
            document.getElementById('total-used').textContent = stats.total_used;
            document.getElementById('usage-rate').textContent = `${stats.overall_usage_rate.toFixed(1)}%`;

            this.stats = stats;
        } catch (error) {
            console.error('Failed to load dashboard:', error);
            this.showError('ダッシュボードの読み込みに失敗しました');
        }
    }

    async loadCoupons() {
        try {
            const response = await fetch(`${API_BASE_URL}/admin/coupons`);
            const coupons = await response.json();
            this.coupons = coupons;
            this.renderCouponsTable();
        } catch (error) {
            console.error('Failed to load coupons:', error);
            this.showError('クーポンの読み込みに失敗しました');
        }
    }

    renderCouponsTable() {
        const tbody = document.getElementById('coupons-tbody');
        tbody.innerHTML = '';

        this.coupons.forEach(coupon => {
            const row = document.createElement('tr');
            
            const now = new Date();
            const expiresAt = new Date(coupon.expires_at);
            let status = 'active';
            let statusText = 'アクティブ';
            
            if (!coupon.is_active) {
                status = 'inactive';
                statusText = '非アクティブ';
            } else if (expiresAt <= now) {
                status = 'expired';
                statusText = '期限切れ';
            }

            // Get user count for this coupon
            const userCount = this.getUserCount(coupon.id);

            row.innerHTML = `
                <td>${coupon.shop_name}</td>
                <td>${coupon.title}</td>
                <td>${coupon.base_discount}%</td>
                <td>${this.formatDate(coupon.created_at)}</td>
                <td>${this.formatDate(coupon.expires_at)}</td>
                <td><span class="status ${status}">${statusText}</span></td>
                <td>${userCount}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-success btn-sm" onclick="adminApp.showCouponDetails('${coupon.id}')">詳細</button>
                        <button class="btn btn-warning btn-sm" onclick="adminApp.editCoupon('${coupon.id}')">編集</button>
                        <button class="btn btn-danger btn-sm" onclick="adminApp.deleteCoupon('${coupon.id}')">削除</button>
                    </div>
                </td>
            `;

            tbody.appendChild(row);
        });
    }

    getUserCount(couponId) {
        // This is a placeholder. In a real app, this would come from the API
        return Math.floor(Math.random() * 10);
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('ja-JP', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    async createCoupon() {
        const formData = {
            shop_name: document.getElementById('shop-name').value,
            title: document.getElementById('coupon-title').value,
            base_discount: parseInt(document.getElementById('base-discount').value),
            expires_minutes: parseInt(document.getElementById('expires-minutes').value),
            location: {
                lat: parseFloat(document.getElementById('latitude').value),
                lng: parseFloat(document.getElementById('longitude').value)
            },
            conditions: document.getElementById('conditions').value || null
        };

        try {
            const response = await fetch(`${API_BASE_URL}/admin/coupons`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData),
            });

            if (response.ok) {
                this.showSuccess('クーポンが作成されました');
                document.getElementById('create-coupon-form').reset();
                if (this.currentView === 'coupons') {
                    this.loadCoupons();
                }
            } else {
                const error = await response.json();
                this.showError(error.detail || 'クーポンの作成に失敗しました');
            }
        } catch (error) {
            console.error('Failed to create coupon:', error);
            this.showError('クーポンの作成に失敗しました');
        }
    }

    editCoupon(couponId) {
        const coupon = this.coupons.find(c => c.id === couponId);
        if (!coupon) return;

        document.getElementById('edit-coupon-id').value = coupon.id;
        document.getElementById('edit-shop-name').value = coupon.shop_name;
        document.getElementById('edit-coupon-title').value = coupon.title;
        document.getElementById('edit-base-discount').value = coupon.base_discount;
        document.getElementById('edit-latitude').value = coupon.location.lat;
        document.getElementById('edit-longitude').value = coupon.location.lng;
        document.getElementById('edit-is-active').checked = coupon.is_active;

        document.getElementById('edit-modal').classList.add('active');
    }

    closeEditModal() {
        document.getElementById('edit-modal').classList.remove('active');
    }

    async updateCoupon() {
        const couponId = document.getElementById('edit-coupon-id').value;
        const formData = {
            shop_name: document.getElementById('edit-shop-name').value,
            title: document.getElementById('edit-coupon-title').value,
            base_discount: parseInt(document.getElementById('edit-base-discount').value),
            location: {
                lat: parseFloat(document.getElementById('edit-latitude').value),
                lng: parseFloat(document.getElementById('edit-longitude').value)
            },
            is_active: document.getElementById('edit-is-active').checked
        };

        try {
            const response = await fetch(`${API_BASE_URL}/admin/coupons/${couponId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData),
            });

            if (response.ok) {
                this.showSuccess('クーポンが更新されました');
                this.closeEditModal();
                this.loadCoupons();
            } else {
                const error = await response.json();
                this.showError(error.detail || 'クーポンの更新に失敗しました');
            }
        } catch (error) {
            console.error('Failed to update coupon:', error);
            this.showError('クーポンの更新に失敗しました');
        }
    }

    async deleteCoupon(couponId) {
        if (!confirm('このクーポンを削除しますか？この操作は取り消せません。')) {
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/admin/coupons/${couponId}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                this.showSuccess('クーポンが削除されました');
                this.loadCoupons();
                if (this.currentView === 'dashboard') {
                    this.loadDashboard();
                }
            } else {
                const error = await response.json();
                this.showError(error.detail || 'クーポンの削除に失敗しました');
            }
        } catch (error) {
            console.error('Failed to delete coupon:', error);
            this.showError('クーポンの削除に失敗しました');
        }
    }

    async showCouponDetails(couponId) {
        try {
            const response = await fetch(`${API_BASE_URL}/admin/coupons/${couponId}`);
            const data = await response.json();

            const content = document.getElementById('details-content');
            content.innerHTML = `
                <div style="padding: 20px;">
                    <div style="margin-bottom: 20px;">
                        <h4>基本情報</h4>
                        <p><strong>店舗名:</strong> ${data.coupon.shop_name}</p>
                        <p><strong>タイトル:</strong> ${data.coupon.title}</p>
                        <p><strong>割引率:</strong> ${data.coupon.base_discount}%</p>
                        <p><strong>作成日:</strong> ${this.formatDate(data.coupon.created_at)}</p>
                        <p><strong>期限:</strong> ${this.formatDate(data.coupon.expires_at)}</p>
                        <p><strong>位置:</strong> (${data.coupon.location.lat}, ${data.coupon.location.lng})</p>
                        <p><strong>ステータス:</strong> ${data.coupon.is_active ? 'アクティブ' : '非アクティブ'}</p>
                    </div>

                    <div class="details-stats">
                        <div class="details-stat">
                            <div class="details-stat-number">${data.stats.total_obtained}</div>
                            <div class="details-stat-label">取得数</div>
                        </div>
                        <div class="details-stat">
                            <div class="details-stat-number">${data.stats.total_used}</div>
                            <div class="details-stat-label">使用数</div>
                        </div>
                        <div class="details-stat">
                            <div class="details-stat-number">${data.stats.usage_rate.toFixed(1)}%</div>
                            <div class="details-stat-label">使用率</div>
                        </div>
                    </div>

                    <div class="users-list">
                        <h4>取得ユーザー</h4>
                        ${data.obtained_by_users.length === 0 ? 
                            '<p>まだ誰も取得していません</p>' :
                            data.obtained_by_users.map(user => `
                                <div class="user-item">
                                    <div class="user-id">ユーザー: ${user.user_id}</div>
                                    <div class="user-time">取得日時: ${this.formatDate(user.obtained_at)}</div>
                                    <div class="user-status ${user.is_used ? 'used' : 'unused'}">
                                        ${user.is_used ? 
                                            `使用済み (${this.formatDate(user.used_at)})` : 
                                            '未使用'
                                        }
                                    </div>
                                </div>
                            `).join('')
                        }
                    </div>
                </div>
            `;

            document.getElementById('details-modal').classList.add('active');
        } catch (error) {
            console.error('Failed to load coupon details:', error);
            this.showError('クーポン詳細の読み込みに失敗しました');
        }
    }

    closeDetailsModal() {
        document.getElementById('details-modal').classList.remove('active');
    }

    showError(message) {
        this.showMessage(message, 'error');
    }

    showSuccess(message) {
        this.showMessage(message, 'success');
    }

    showMessage(message, type) {
        // Remove existing messages
        document.querySelectorAll('.error, .success').forEach(el => el.remove());

        const messageEl = document.createElement('div');
        messageEl.className = type;
        messageEl.textContent = message;

        const mainContent = document.querySelector('.main-content');
        mainContent.insertBefore(messageEl, mainContent.firstChild);

        // Auto remove after 5 seconds
        setTimeout(() => {
            if (messageEl.parentNode) {
                messageEl.remove();
            }
        }, 5000);
    }
}

// Initialize the app
const adminApp = new AdminApp();