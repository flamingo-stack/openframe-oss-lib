package com.openframe.api.service;

import com.openframe.data.document.cluster.ClusterRegistration;
import com.openframe.data.repository.cluster.ClusterRegistrationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class ClusterRegistrationQueryService {

    private final ClusterRegistrationRepository clusterRegistrationRepository;

    public Optional<ClusterRegistration> getClusterRegistration() {
        log.debug("Retrieving current cluster registration");
        return clusterRegistrationRepository.findFirstByOrderByCreatedAtAsc();
    }
}

