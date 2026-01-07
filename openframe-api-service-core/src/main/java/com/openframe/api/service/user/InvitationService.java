package com.openframe.api.service.user;

import com.openframe.api.dto.invitation.CreateInvitationRequest;
import com.openframe.api.dto.invitation.InvitationPageResponse;
import com.openframe.api.dto.invitation.InvitationResponse;
import com.openframe.api.dto.Role;
import com.openframe.api.mapper.InvitationMapper;
import com.openframe.api.service.processor.InvitationProcessor;
import com.openframe.data.document.user.Invitation;
import com.openframe.data.document.user.InvitationStatus;
import com.openframe.data.repository.user.InvitationRepository;
import com.openframe.notification.mail.service.EmailService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class InvitationService {

    private final InvitationRepository invitationRepository;
    private final InvitationMapper invitationMapper;
    private final EmailService emailService;
    private final UserService userService;
    private final InvitationProcessor invitationProcessor;

    public InvitationResponse createInvitation(CreateInvitationRequest request) {
        if (userService.existsActiveUserByEmail(request.getEmail())) {
            throw new IllegalStateException("User with email " + request.getEmail() + " already exists in tenant");
        }

        Invitation saved = invitationRepository.save(invitationMapper.toEntity(request));

        emailService.sendInvitationEmail(saved.getEmail(), saved.getId());

        invitationProcessor.postProcessInvitationCreated(saved);

        log.info("Created invitation id={} email={} expiresAt={} ", saved.getId(), saved.getEmail(), saved.getExpiresAt());

        return invitationMapper.toResponse(saved);
    }

    public InvitationPageResponse listInvitations(int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        Page<Invitation> p = invitationRepository.findByStatusNotIn(
                List.of(InvitationStatus.ACCEPTED, InvitationStatus.REVOKED),
                pageable
        );
        return InvitationPageResponse.builder()
                .items(p.getContent().stream().map(invitationMapper::toResponse).toList())
                .page(p.getNumber())
                .size(p.getSize())
                .totalElements(p.getTotalElements())
                .totalPages(p.getTotalPages())
                .hasNext(p.hasNext())
                .build();
    }

    public void revokeInvitation(String id) {
        Invitation invitation = invitationRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Invitation not found"));

        if (!InvitationStatus.PENDING.equals(invitation.getStatus())) {
            throw new IllegalStateException("Only pending invitations can be revoked");
        }

        invitation.setStatus(InvitationStatus.REVOKED);
        Invitation revokedInvitation = invitationRepository.save(invitation);

        invitationProcessor.postProcessInvitationRevoked(revokedInvitation);
    }

    public InvitationResponse renewInvitation(String expiredInvitationId) {
        Invitation old = invitationRepository.findById(expiredInvitationId)
                .orElseThrow(() -> new IllegalArgumentException("Invitation not found"));

        CreateInvitationRequest req = CreateInvitationRequest.builder()
                .email(old.getEmail())
                .roles(old.getRoles().stream().map(r -> Role.valueOf(r.name())).toList())
                .build();

        InvitationResponse created = createInvitation(req);

        old.setStatus(InvitationStatus.REVOKED);
        Invitation revoked = invitationRepository.save(old);
        invitationProcessor.postProcessInvitationRevoked(revoked);

        log.info("Resent invitation from id={} to new id={} email={}",
                old.getId(), created.getId(), created.getEmail());
        return created;
    }
}


