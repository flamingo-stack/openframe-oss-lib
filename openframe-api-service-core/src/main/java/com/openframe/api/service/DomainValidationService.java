package com.openframe.api.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class DomainValidationService {

    private final DomainExistenceValidator domainExistenceValidator;

    private static final Set<String> GENERIC_PUBLIC_DOMAINS = Set.of(
            // Google
            "gmail.com",
            "googlemail.com",
            // Yahoo
            "yahoo.com",
            // Microsoft
            "outlook.com",
            "hotmail.com",
            "live.com",
            "msn.com",
            // Apple
            "icloud.com",
            "me.com",
            "mac.com",
            // Other global
            "aol.com",
            "gmx.com",
            "gmx.net",
            "proton.me",
            "protonmail.com",
            "fastmail.com",
            "mail.com",
            "zoho.com",
            "tutanota.com",
            "tuta.com",
            "yandex.com",
            "mail.ru",
            "inbox.com",
            // China
            "qq.com",
            "163.com",
            "126.com",
            // Korea
            "naver.com",
            "daum.net",
            "hanmail.net",
            // Germany
            "web.de",
            "gmx.de",
            "t-online.de",
            // Italy
            "libero.it",
            // Poland
            "wp.pl",
            "o2.pl",
            "onet.pl",
            // Czech
            "seznam.cz",
            // Russia
            "rambler.ru",
            // Ukraine
            "ukr.net",
            "i.ua",
            "meta.ua",
            // France
            "orange.fr",
            "laposte.net",
            // UK
            "btinternet.com",
            "sky.com",
            // US ISPs
            "att.net",
            "sbcglobal.net",
            "verizon.net",
            "comcast.net",
            "cox.net",
            "charter.net",
            "earthlink.net",
            // Privacy-focused
            "mailbox.org",
            "posteo.de",
            "hushmail.com",
            "mailfence.com",
            "startmail.com",
            "runbox.com"
    );

    public void validateExists(List<String> domains) {
        if (domains.isEmpty()) {
            return;
        }
        boolean anyExists = domainExistenceValidator.anyExists(domains);
        if (anyExists) {
            throw new IllegalArgumentException("One or more domains already exist in the system");
        }
    }

    public void validateGenericPublicDomain(List<String> domains) {
        if (domains.isEmpty()) {
            return;
        }
        List<String> found = domains.stream()
                .filter(GENERIC_PUBLIC_DOMAINS::contains)
                .toList();

        if (!found.isEmpty()) {
            throw new IllegalArgumentException("Generic domains not allowed: " + found);
        }
    }

    public boolean isGenericPublicDomain(String domain) {
        return GENERIC_PUBLIC_DOMAINS.contains(domain);
    }
}
