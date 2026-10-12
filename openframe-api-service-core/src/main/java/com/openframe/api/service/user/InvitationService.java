package com.openframe.api.service.user;

import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.invitation.CreateInvitationRequest;
import com.openframe.api.dto.invitation.InvitationFilterInput;
import com.openframe.api.dto.invitation.InvitationPageResponse;
import com.openframe.api.dto.invitation.InvitationResponse;
import com.openframe.api.dto.Role;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.PageInfo;
import com.openframe.api.mapper.InvitationMapper;
import com.openframe.api.service.processor.InvitationProcessor;
import com.openframe.core.email.EmailDomainPolicy;
import com.openframe.data.document.user.Invitation;
import com.openframe.data.document.user.InvitationStatus;
import com.openframe.data.repository.user.InvitationPageCursor;
import com.openframe.data.repository.user.InvitationRepository;
import com.openframe.notification.mail.service.EmailService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class InvitationService {

    private final InvitationRepository invitationRepository;
    private final InvitationMapper invitationMapper;
    private final EmailService emailService;
    private final UserService userService;
    private final InvitationProcessor invitationProcessor;
    private final EmailDomainPolicy emailDomainPolicy;

    public InvitationResponse createInvitation(CreateInvitationRequest request) {
        emailDomainPolicy.ensureEmailAllowed(request.getEmail());

        if (userService.existsActiveUserByEmail(request.getEmail())) {
            throw new IllegalStateException("User with email " + request.getEmail() + " already exists in tenant");
        }

        Invitation saved = invitationRepository.save(invitationMapper.toEntity(request));

        emailService.sendInvitationEmail(saved.getEmail(), saved.getId());

        invitationProcessor.postProcessInvitationCreated(saved);

        log.info("Created invitation id={} email={} expiresAt={} ", saved.getId(), saved.getEmail(), saved.getExpiresAt());

        return invitationMapper.toResponse(saved);
    }

    /** Upper bound for a REST page; lower it once no client asks for every invitation in one page. */
    static final int MAX_REST_PAGE_SIZE = 1000;

    /** The order of the GraphQL connection, so a REST page and a GraphQL page agree. */
    static final Sort INVITATION_ORDER = Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("_id"));

    public InvitationPageResponse listInvitations(int page, int size) {
        Pageable pageable = PageRequest.of(Math.max(page, 0), Math.clamp(size, 1, MAX_REST_PAGE_SIZE),
                INVITATION_ORDER);
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

    /** Open (PENDING in storage) invitations; EXPIRED is a PENDING one past its {@code expiresAt}. */
    public CountedGenericQueryResult<InvitationResponse> queryInvitations(InvitationFilterInput filter, String search,
                                                                         CursorPaginationCriteria pagination) {
        CursorPaginationCriteria page = pagination.normalize();
        Boolean expired = filter != null ? filter.expiredOnly() : null;
        Instant now = Instant.now();
        long filteredCount = invitationRepository.countOpenInvitations(expired, now, search);
        List<Invitation> raw = invitationRepository.findOpenInvitationsPage(
                expired, now, search, page.getCursor(), page.getLimit() + 1);
        boolean hasNextPage = raw.size() > page.getLimit();
        List<InvitationResponse> items = (hasNextPage ? raw.subList(0, page.getLimit()) : raw).stream()
                .map(invitationMapper::toResponse)
                .toList();
        return CountedGenericQueryResult.<InvitationResponse>builder()
                .items(items)
                .pageInfo(PageInfo.builder()
                        .hasNextPage(hasNextPage)
                        .hasPreviousPage(page.hasCursor())
                        .startCursor(items.isEmpty() ? null : cursorOf(items.getFirst()))
                        .endCursor(items.isEmpty() ? null : cursorOf(items.getLast()))
                        .build())
                .filteredCount((int) filteredCount)
                .build();
    }

    /** An open invitation by id; accepted and revoked ones are not exposed. */
    public Optional<InvitationResponse> findOpenInvitation(String id) {
        return invitationRepository.findById(id)
                .filter(invitation -> InvitationStatus.PENDING.equals(invitation.getStatus()))
                .map(invitationMapper::toResponse);
    }

    private static String cursorOf(InvitationResponse invitation) {
        return CursorCodec.encode(InvitationPageCursor.of(invitation.getCreatedAt(), invitation.getId()));
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

        // Validate status and time-based expiration to avoid inconsistent states
        if (!InvitationStatus.PENDING.equals(old.getStatus())) {
            throw new IllegalStateException("Only pending invitations can be resent");
        }
        if (old.getExpiresAt() == null || !old.getExpiresAt().isBefore(Instant.now())) {
            throw new IllegalStateException("Only expired invitations can be resent");
        }

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


