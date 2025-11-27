package com.openframe.management.controller;

import com.openframe.management.dto.ReleaseVersionRequest;
import com.openframe.management.service.ReleaseVersionService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

@Slf4j
@RestController
@RequestMapping("/v1/cluster-registrations")
@RequiredArgsConstructor
public class ReleaseVersionController {

    private final ReleaseVersionService releaseVersionService;

    @PostMapping
    public void updateReleaseVersion(@RequestBody ReleaseVersionRequest request) {
        releaseVersionService.process(request.getImageTagVersion());
    }
}

