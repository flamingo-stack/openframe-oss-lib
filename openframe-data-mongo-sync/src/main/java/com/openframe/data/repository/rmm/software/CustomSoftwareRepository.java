package com.openframe.data.repository.rmm.software;

import com.openframe.data.document.rmm.software.Software;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface CustomSoftwareRepository {

    Page<Software> findTitles(SoftwareTitleQuery titles, Pageable pageable);
}
