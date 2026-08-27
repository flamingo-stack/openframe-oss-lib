package com.openframe.api.service.ticket;

import com.openframe.api.dto.ticket.TicketFilterInput;
import com.openframe.security.authentication.AuthPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Component
@RequiredArgsConstructor
public class TicketIdRestrictionResolver {

    private final List<TicketIdRestriction> restrictions;

    // null means "no restriction at all"; an empty list means "nothing matches" — the two are opposite
    // outcomes downstream, so an applicable restriction that found nothing must not collapse to null.
    public List<String> resolve(AuthPrincipal principal, TicketFilterInput filter) {
        List<String> restricted = null;
        for (TicketIdRestriction restriction : restrictions) {
            if (!restriction.isApplicable(filter)) {
                continue;
            }
            List<String> ticketIds = restriction.ticketIds(principal, filter);
            restricted = restricted == null ? ticketIds : intersect(restricted, ticketIds);
        }
        return restricted;
    }

    private List<String> intersect(List<String> left, List<String> right) {
        Set<String> retained = new HashSet<>(right);
        return left.stream().filter(retained::contains).toList();
    }
}
