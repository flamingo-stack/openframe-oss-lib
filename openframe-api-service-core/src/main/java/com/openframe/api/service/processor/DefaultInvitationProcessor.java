package com.openframe.api.service.processor;

import com.openframe.data.document.user.Invitation;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.stereotype.Component;

/**
 * Default implementation of InvitationProcessor.
 * This bean will be used if no other implementation is provided.
 */
@Slf4j
@Component
@ConditionalOnMissingBean(value = InvitationProcessor.class, ignored = DefaultInvitationProcessor.class)
public class DefaultInvitationProcessor implements InvitationProcessor {

    @Override
    public void postProcessInvitationCreated(Invitation invitation) {
        log.debug("Invitation created: id={}, email={}", invitation.getId(), invitation.getEmail());
    }

    @Override
    public void postProcessInvitationRevoked(Invitation invitation) {
        log.debug("Invitation revoked: id={}, email={}", invitation.getId(), invitation.getEmail());
    }
}