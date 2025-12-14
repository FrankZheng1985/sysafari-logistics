// Mock API 服务器 - 用于界面检查，绕过后端验证
// 使用方法：在 index.html 中引入此文件

(function() {
    'use strict';
    
    console.log('🔧 Mock API 模式已启用 - 用于界面检查');
    
    // 保存原始的 fetch 和 XMLHttpRequest
    const originalFetch = window.fetch;
    const originalXHROpen = XMLHttpRequest.prototype.open;
    const originalXHRSend = XMLHttpRequest.prototype.send;
    
    // Mock 登录响应
    const mockLoginResponse = {
        errCode: 200,
        msg: 'success',
        data: {
            id: 1,
            username: 'admin',
            name: '管理员',
            avatar: 'https://gw.alipayobjects.com/zos/antfincdn/XAosXuNZyF/BiazfanxmamNRoxxVxka.png',
            roles: ['ROLE_ASL_ADMIN'],
            hasAudit: true,
            aslHasCheck: true,
            hasLicense: true,
            hasInvoiceHead: true,
            companyId: 1,
            ktCode: 'TEST001'
        }
    };
    
    // Mock 用户列表
    const mockUserList = {
        errCode: 200,
        data: [
            {
                id: 1,
                username: 'admin',
                name: '管理员',
                signedContract: true
            }
        ]
    };
    
    // 拦截 fetch 请求
    window.fetch = function(url, options) {
        const urlStr = typeof url === 'string' ? url : url.url || '';
        
        // 登录接口
        if (urlStr.includes('/login') || urlStr.includes('/user/login') || urlStr.includes('/api/login')) {
            console.log('🔧 Mock: 拦截登录请求', urlStr);
            return Promise.resolve({
                ok: true,
                status: 200,
                json: () => Promise.resolve(mockLoginResponse),
                text: () => Promise.resolve(JSON.stringify(mockLoginResponse))
            });
        }
        
        // 用户列表接口
        if (urlStr.includes('/user/list') || urlStr.includes('/api/user/list')) {
            console.log('🔧 Mock: 拦截用户列表请求', urlStr);
            return Promise.resolve({
                ok: true,
                status: 200,
                json: () => Promise.resolve(mockUserList),
                text: () => Promise.resolve(JSON.stringify(mockUserList))
            });
        }
        
        // 其他API请求 - 返回空数据
        if (urlStr.includes('/api/') || urlStr.startsWith('/api')) {
            console.log('🔧 Mock: 拦截API请求（返回空数据）', urlStr);
            return Promise.resolve({
                ok: true,
                status: 200,
                json: () => Promise.resolve({ errCode: 200, data: [], msg: 'mock' }),
                text: () => Promise.resolve(JSON.stringify({ errCode: 200, data: [], msg: 'mock' }))
            });
        }
        
        // 其他请求正常处理
        return originalFetch.apply(this, arguments);
    };
    
    // 拦截 XMLHttpRequest
    let xhrRequestUrl = '';
    XMLHttpRequest.prototype.open = function(method, url, ...args) {
        xhrRequestUrl = url;
        return originalXHROpen.apply(this, [method, url, ...args]);
    };
    
    XMLHttpRequest.prototype.send = function(...args) {
        const url = xhrRequestUrl;
        
        // 登录接口
        if (url && (url.includes('/login') || url.includes('/user/login') || url.includes('/api/login'))) {
            console.log('🔧 Mock: 拦截登录请求 (XHR)', url);
            setTimeout(() => {
                this.status = 200;
                this.responseText = JSON.stringify(mockLoginResponse);
                this.readyState = 4;
                if (this.onload) this.onload();
                if (this.onreadystatechange) this.onreadystatechange();
            }, 100);
            return;
        }
        
        // 用户列表接口
        if (url && (url.includes('/user/list') || url.includes('/api/user/list'))) {
            console.log('🔧 Mock: 拦截用户列表请求 (XHR)', url);
            setTimeout(() => {
                this.status = 200;
                this.responseText = JSON.stringify(mockUserList);
                this.readyState = 4;
                if (this.onload) this.onload();
                if (this.onreadystatechange) this.onreadystatechange();
            }, 100);
            return;
        }
        
        // 其他API请求
        if (url && (url.includes('/api/') || url.startsWith('/api'))) {
            console.log('🔧 Mock: 拦截API请求 (XHR) - 返回空数据', url);
            setTimeout(() => {
                this.status = 200;
                this.responseText = JSON.stringify({ errCode: 200, data: [], msg: 'mock' });
                this.readyState = 4;
                if (this.onload) this.onload();
                if (this.onreadystatechange) this.onreadystatechange();
            }, 100);
            return;
        }
        
        return originalXHRSend.apply(this, args);
    };
    
    // 设置全局标志
    window.MOCK_API_MODE = true;
    console.log('✅ Mock API 模式已激活，可以检查界面了');
})();

