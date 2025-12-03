package com.openframe.api.service;

import java.util.List;

public interface DomainExistenceValidator {
    boolean anyExists(List<String> domains);
}


