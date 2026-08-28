package com.openframe.api.service.ticket.spi;

import java.util.Optional;

/**
 * Supplies the average end-user rating for ticket statistics. Ratings are collected by the
 * conversational layer, so the core has no source of its own; without a provider the statistics
 * report no rating.
 */
public interface TicketRatingProvider {

    Optional<Double> averageRating();
}
