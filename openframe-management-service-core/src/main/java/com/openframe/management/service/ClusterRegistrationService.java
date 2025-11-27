package com.openframe.management.service;

import com.openframe.data.document.cluster.ClusterRegistration;
import com.openframe.data.repository.cluster.ClusterRegistrationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class ClusterRegistrationService {

    private final ClusterRegistrationRepository clusterRegistrationRepository;

    public ClusterRegistration processClusterRegistration(String imageTagVersion) {
        log.info("Processing cluster registration with image tag version: {}", imageTagVersion);
        
        return clusterRegistrationRepository.findFirstByOrderByCreatedAtAsc()
                .map(existing -> updateExistingClusterRegistration(existing, imageTagVersion))
                .orElseGet(() -> createNewClusterRegistration(imageTagVersion));
    }

    private ClusterRegistration updateExistingClusterRegistration(ClusterRegistration existing, String imageTagVersion) {
        log.info("Updating existing cluster registration from {} to {}", existing.getImageTagVersion(), imageTagVersion);
        existing.setImageTagVersion(imageTagVersion);
        
        ClusterRegistration saved = clusterRegistrationRepository.save(existing);
        log.info("Successfully updated cluster registration: {} with id: {}", saved.getImageTagVersion(), saved.getId());
        
        return saved;
    }

    private ClusterRegistration createNewClusterRegistration(String imageTagVersion) {
        log.info("Creating initial cluster registration record for: {}", imageTagVersion);
        ClusterRegistration newClusterRegistration = new ClusterRegistration();
        newClusterRegistration.setImageTagVersion(imageTagVersion);
        
        ClusterRegistration saved = clusterRegistrationRepository.save(newClusterRegistration);
        log.info("Successfully created cluster registration: {} with id: {}", saved.getImageTagVersion(), saved.getId());
        
        return saved;
    }
}

