package com.openframe.event.jobs.reconciliation;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.util.List;

// The service's copies, resolved once at startup; a holder, so Spring does not inject a List<MappedCopy> as beans of the type.
@Getter
@AllArgsConstructor
public class MappedCopies {

    private final List<MappedCopy> copies;
}
