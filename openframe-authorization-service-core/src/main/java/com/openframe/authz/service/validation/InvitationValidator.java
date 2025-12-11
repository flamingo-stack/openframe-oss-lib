package com.openframe.authz.service.validation;

import com.openframe.data.document.auth.AuthInvitation;
import com.openframe.data.repository.auth.AuthInvitationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Instant;

import static com.openframe.data.document.user.InvitationStatus.PENDING;

@Service
@RequiredArgsConstructor
public class InvitationValidator {

    private final AuthInvitationRepository invitationRepository;

    public AuthInvitation loadAndEnsureAcceptable(String invitationId) {
        AuthInvitation inv = invitationRepository.findById(invitationId)
                .orElseThrow(() -> new IllegalArgumentException("Invitation not found"));
        ensureAcceptable(inv);
        return inv;
    }

    public void ensureAcceptable(AuthInvitation inv) {
        if (inv.getStatus() != PENDING) {
            throw new IllegalStateException("Invitation already used or revoked");
        }
        if (inv.getExpiresAt() != null && inv.getExpiresAt().isBefore(Instant.now())) {
            throw new IllegalStateException("Invitation expired");
        }
    }
}

