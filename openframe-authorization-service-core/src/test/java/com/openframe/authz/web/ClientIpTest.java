package com.openframe.authz.web;

import jakarta.servlet.http.HttpServletRequestWrapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import static org.assertj.core.api.Assertions.assertThat;

class ClientIpTest {

    @AfterEach
    void clearRequestContext() {
        RequestContextHolder.resetRequestAttributes();
    }

    @Test
    void theStoredAttribute_winsOverTheRemoteAddress() {
        MockHttpServletRequest request = request("10.0.0.5");
        request.setAttribute(ClientIp.ATTRIBUTE, "203.0.113.7");

        assertThat(ClientIp.of(request)).isEqualTo("203.0.113.7");
    }

    @Test
    void withoutTheAttribute_theUnwrappedRemoteAddressStands() {
        HttpServletRequestWrapper forwarded = new HttpServletRequestWrapper(request("203.0.113.7")) {
            @Override
            public String getRemoteAddr() {
                return "1.2.3.4";
            }
        };

        assertThat(ClientIp.of(forwarded)).isEqualTo("203.0.113.7");
    }

    @Test
    void current_readsTheRequestOnThisThread() {
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request("203.0.113.7")));

        assertThat(ClientIp.current()).isEqualTo("203.0.113.7");
    }

    @Test
    void offTheRequestThread_thereIsNoIp() {
        assertThat(ClientIp.current()).isNull();
        assertThat(ClientIp.of(null)).isNull();
    }

    private static MockHttpServletRequest request(String remoteAddr) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr(remoteAddr);
        return request;
    }
}
