package com.openframe.api.service.ticket;

import com.openframe.data.document.ticket.Ticket;
import com.openframe.data.document.ticket.TicketResolver;
import com.openframe.data.repository.user.UserRepository;
import com.openframe.security.authentication.ActorType;
import com.openframe.security.authentication.AuthPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import static org.springframework.util.StringUtils.hasText;

/**
 * Records who resolved a ticket. The AI assistant acts with the synthetic {@link #AI_AGENT_ID}
 * principal and resolves on the end user's behalf; anyone else is a technician.
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = TicketFeature.ENABLED, havingValue = "true")
public class TicketResolverStamp {

    public static final String AI_AGENT_ID = "AI_AGENT";

    private final UserRepository userRepository;

    public void stamp(Ticket ticket, AuthPrincipal principal) {
        if (AI_AGENT_ID.equals(principal.getId())) {
            ticket.setResolvedBy(TicketResolver.END_USER);
            ticket.setResolvedById(null);
            ticket.setResolvedByName(null);
            return;
        }
        ticket.setResolvedBy(TicketResolver.TECHNICIAN);
        ticket.setResolvedById(principal.getId());
        String resolverName = resolveName(principal);
        ticket.setResolvedByName(hasText(resolverName) ? resolverName : principal.getId());
    }

    /** Profile name for admins (falls back to the token's display name), token display name otherwise. */
    public String resolveName(AuthPrincipal principal) {
        if (principal == null) {
            return null;
        }
        if (principal.getActorType() != ActorType.ADMIN) {
            return principal.getDisplayName();
        }
        return userRepository.findById(principal.getId())
                .map(TicketUserNames::profileName)
                .filter(name -> hasText(name))
                .orElseGet(principal::getDisplayName);
    }
}
