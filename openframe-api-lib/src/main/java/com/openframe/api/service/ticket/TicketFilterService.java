package com.openframe.api.service.ticket;

import com.openframe.api.dto.ticket.TicketFilterInput;
import com.openframe.api.dto.ticket.TicketFilterOption;
import com.openframe.api.dto.ticket.TicketFilters;
import com.openframe.data.document.ticket.TicketStatus;
import com.openframe.data.repository.organization.OrganizationRepository;
import com.openframe.data.repository.user.UserRepository;
import com.openframe.security.authentication.AuthPrincipal;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.validation.annotation.Validated;

import java.util.Arrays;
import java.util.List;
import java.util.concurrent.CompletableFuture;

import static com.openframe.api.util.AuthPrincipalUtils.validateAdminAccess;

/**
 * Filter options for the ticket list. Tag option values are raw tag ids; GraphQL callers encode
 * them into Relay global ids themselves.
 */
@Service
@Slf4j
@Validated
@RequiredArgsConstructor
@ConditionalOnProperty(name = TicketFeature.ENABLED, havingValue = "true")
public class TicketFilterService {

    private final TicketTagService ticketTagService;
    private final OrganizationRepository organizationRepository;
    private final UserRepository userRepository;
    private final TicketStatusService ticketStatusService;

    @Value("${" + TicketFeature.LIFECYCLE_ENABLED + ":false}")
    private boolean lifecycleEnabled;

    public CompletableFuture<TicketFilters> getFilters(AuthPrincipal principal, TicketFilterInput filter) {
        validateAdminAccess(principal);
        log.debug("Fetching ticket filters with current filter: {}", filter);

        CompletableFuture<List<TicketFilterOption>> statusFuture =
                CompletableFuture.supplyAsync(this::getStatusOptions);
        CompletableFuture<List<TicketFilterOption>> orgFuture =
                CompletableFuture.supplyAsync(this::getOrganizationOptions);
        CompletableFuture<List<TicketFilterOption>> assigneeFuture =
                CompletableFuture.supplyAsync(this::getAssigneeOptions);
        CompletableFuture<List<TicketFilterOption>> tagFuture =
                CompletableFuture.supplyAsync(this::getTagOptions);

        return CompletableFuture.allOf(statusFuture, orgFuture, assigneeFuture, tagFuture)
                .thenApply(v -> TicketFilters.builder()
                        .statuses(statusFuture.join())
                        .organizationIds(orgFuture.join())
                        .assigneeIds(assigneeFuture.join())
                        .tagIds(tagFuture.join())
                        .build());
    }

    private List<TicketFilterOption> getStatusOptions() {
        // TODO(lifecycle-rollout): drop the legacy enum branch after rollout
        if (lifecycleEnabled) {
            return ticketStatusService.list().stream()
                    .map(status -> TicketFilterOption.builder()
                            .value(status.getId())
                            .label(status.getName())
                            .build())
                    .toList();
        }
        return Arrays.stream(TicketStatus.values())
                .map(status -> TicketFilterOption.builder()
                        .value(status.name())
                        .label(status.name())
                        .build())
                .toList();
    }

    private List<TicketFilterOption> getOrganizationOptions() {
        return organizationRepository.findAll().stream()
                .map(org -> TicketFilterOption.builder()
                        .value(org.getOrganizationId())
                        .label(org.getName())
                        .build())
                .toList();
    }

    private List<TicketFilterOption> getAssigneeOptions() {
        return userRepository.findAll().stream()
                .map(user -> TicketFilterOption.builder()
                        .value(user.getId())
                        .label(TicketUserNames.displayName(user))
                        .build())
                .toList();
    }

    private List<TicketFilterOption> getTagOptions() {
        return ticketTagService.getTags().stream()
                .map(tag -> TicketFilterOption.builder()
                        .value(tag.getId())
                        .label(tag.getKey())
                        .build())
                .toList();
    }
}
