package com.openframe.api.dataloader;

import com.netflix.graphql.dgs.DgsDataLoader;
import com.openframe.data.document.ticket.TicketStatusDefinition;
import com.openframe.data.repository.ticket.TicketStatusDefinitionRepository;
import lombok.RequiredArgsConstructor;
import org.dataloader.MappedBatchLoader;

import java.util.Map;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.StreamSupport;

/**
 * Status definitions for a page of tickets in one lookup. A board has a handful of statuses and a
 * page has many tickets, so the keys collapse hard — without batching this is one query per row.
 */
@DgsDataLoader(name = TicketStatusDefinitionDataLoader.NAME)
@RequiredArgsConstructor
public class TicketStatusDefinitionDataLoader implements MappedBatchLoader<String, TicketStatusDefinition> {

    public static final String NAME = "ticketStatusDefinitionLoader";

    private final TicketStatusDefinitionRepository statusRepository;

    @Override
    public CompletionStage<Map<String, TicketStatusDefinition>> load(Set<String> statusIds) {
        return CompletableFuture.supplyAsync(() ->
                StreamSupport.stream(statusRepository.findAllById(statusIds).spliterator(), false)
                        .collect(Collectors.toMap(TicketStatusDefinition::getId, Function.identity())));
    }
}
