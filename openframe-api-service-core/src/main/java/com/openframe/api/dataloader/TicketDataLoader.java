package com.openframe.api.dataloader;

import com.netflix.graphql.dgs.DgsDataLoader;
import com.openframe.data.document.ticket.Ticket;
import com.openframe.data.repository.ticket.TicketRepository;
import lombok.RequiredArgsConstructor;
import org.dataloader.BatchLoader;

import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.stream.Collectors;

/**
 * DataLoader for batch loading Ticket objects by id.
 * Used by AssignableTarget polymorphic resolution for TICKET target type.
 */
@DgsDataLoader(name = "ticketDataLoader")
@RequiredArgsConstructor
public class TicketDataLoader implements BatchLoader<String, Ticket> {

    private final TicketRepository ticketRepository;

    @Override
    public CompletionStage<List<Ticket>> load(List<String> ticketIds) {
        return CompletableFuture.supplyAsync(() -> {
            Set<String> nonNullIds = ticketIds.stream()
                    .filter(Objects::nonNull)
                    .collect(Collectors.toSet());

            if (nonNullIds.isEmpty()) {
                return ticketIds.stream()
                        .map(id -> (Ticket) null)
                        .collect(Collectors.toList());
            }

            List<Ticket> tickets = ticketRepository.findAllById(nonNullIds);
            Map<String, Ticket> ticketMap = tickets.stream()
                    .collect(Collectors.toMap(Ticket::getId, t -> t));

            return ticketIds.stream()
                    .map(id -> id == null ? null : ticketMap.get(id))
                    .collect(Collectors.toList());
        });
    }
}
