package com.openframe.api.controller;

import com.openframe.api.dto.invitation.CreateInvitationRequest;
import com.openframe.api.dto.invitation.InvitationPageResponse;
import com.openframe.api.dto.invitation.InvitationResponse;
import com.openframe.api.service.user.InvitationService;
import com.openframe.audit.Audited;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import static com.openframe.data.document.audit.AuditAction.INVITATION_CREATE;
import static com.openframe.data.document.audit.AuditAction.INVITATION_RESEND;
import static com.openframe.data.document.audit.AuditAction.INVITATION_REVOKE;

@RestController
@RequestMapping("/invitations")
@RequiredArgsConstructor
public class InvitationController {

    private final InvitationService invitationService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Audited(action = INVITATION_CREATE, targetId = "#result.id")
    public InvitationResponse createInvitation(@Valid @RequestBody CreateInvitationRequest request) {
        return invitationService.createInvitation(request);
    }

    @GetMapping
    @ResponseStatus(HttpStatus.OK)
    public InvitationPageResponse listInvitations(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        return invitationService.listInvitations(page, size);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Audited(action = INVITATION_REVOKE, targetId = "#id")
    public void revokeInvitation(@PathVariable String id) {
        invitationService.revokeInvitation(id);
    }

    @PostMapping("/{id}/resend")
    @ResponseStatus(HttpStatus.CREATED)
    @Audited(action = INVITATION_RESEND, targetId = "#id",
            details = "newInvitationId=T(com.openframe.core.util.Sha256).hex(#result.id)")
    public InvitationResponse resendInvitation(@PathVariable String id) {
        return invitationService.renewInvitation(id);
    }
}
