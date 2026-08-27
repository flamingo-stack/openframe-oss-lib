package com.openframe.api.service.ticket;

import com.openframe.api.dto.ticket.TicketFilterInput;
import com.openframe.security.authentication.AuthPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;

import static org.springframework.util.CollectionUtils.isEmpty;

@Component
@RequiredArgsConstructor
public class TagTicketIdRestriction implements TicketIdRestriction {

    private final TicketTagService ticketTagService;

    @Override
    public boolean isApplicable(TicketFilterInput filter) {
        if (filter == null) {
            return false;
        }
        List<String> tagIds = filter.getTagIds();
        return !isEmpty(tagIds);
    }

    @Override
    public List<String> ticketIds(AuthPrincipal principal, TicketFilterInput filter) {
        List<String> tagIds = filter.getTagIds();
        return ticketTagService.getTicketIdsByTagIds(tagIds);
    }
}
