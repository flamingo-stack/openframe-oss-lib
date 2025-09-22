package com.openframe.api.service.processor;

import com.openframe.data.document.sso.SSOConfig;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.stereotype.Component;

/**
 * Default implementation of SSOConfigProcessor for API service.
 * This bean will be used if no other implementation is provided.
 */
@Slf4j
@Component
@ConditionalOnMissingBean(value = SSOConfigProcessor.class, ignored = DefaultSSOConfigProcessor.class)
public class DefaultSSOConfigProcessor implements SSOConfigProcessor {

    @Override
    public void postProcessConfigSaved(SSOConfig config) {
        log.debug("SSO config saved: provider={}, enabled={}",
                config.getProvider(), config.isEnabled());
    }

    @Override
    public void postProcessConfigDeleted(SSOConfig config) {
        log.debug("SSO config deleted: provider={}", config.getProvider());
    }

    @Override
    public void postProcessConfigToggled(SSOConfig config) {
        log.debug("SSO config toggled: provider={}, enabled={}",
                config.getProvider(), config.isEnabled());
    }
}