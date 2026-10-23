package com.openframe.authz.config.tenant;

import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.filter.ForwardedHeaderFilter;

/**
 * The servlet filters that run ahead of Spring Security, in this order:
 * Spring Session → {@link TenantContextFilter} → {@link TenantForwardedPrefixFilter} → {@link ForwardedHeaderFilter}.
 * All three are ordered relative to {@link TenantContextFilter#ORDER}, which sits after Spring Session.
 */
@Configuration
public class TenantFilterConfig {

    @Bean
    public FilterRegistrationBean<TenantForwardedPrefixFilter> tenantForwardedPrefixFilter() {
        var reg = new FilterRegistrationBean<>(new TenantForwardedPrefixFilter());
        reg.setOrder(TenantContextFilter.ORDER + 5);
        return reg;
    }

    @Bean
    public FilterRegistrationBean<ForwardedHeaderFilter> forwardedHeaderFilter() {
        var reg = new FilterRegistrationBean<>(new ForwardedHeaderFilter());
        reg.setOrder(TenantContextFilter.ORDER + 10);
        return reg;
    }
}
