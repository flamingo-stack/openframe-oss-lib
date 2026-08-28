package com.openframe.test.data.generator.external;

import com.openframe.test.data.dto.external.organization.CreateOrganizationRequest;
import com.openframe.test.data.dto.external.organization.UpdateOrganizationRequest;
import com.openframe.test.data.dto.organization.AddressDto;
import com.openframe.test.data.dto.organization.ContactInformationDto;
import com.openframe.test.data.dto.organization.ContactPersonDto;
import net.datafaker.Faker;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static com.openframe.test.data.generator.external.ExternalTestData.faker;
import static com.openframe.test.data.generator.external.ExternalTestData.uniqueName;

/**
 * Organization payloads for the External API.
 *
 * <p>Separate from {@link com.openframe.test.data.generator.OrganizationGenerator} because the External
 * contract types {@code monthlyRevenue} as a JSON number ({@link BigDecimal}) where the GraphQL DTO uses
 * a String — the same builder cannot serve both.
 */
public class ExternalOrganizationGenerator {

    public static CreateOrganizationRequest createOrganizationRequest() {
        return createOrganizationRequest(true);
    }

    public static CreateOrganizationRequest createOrganizationRequest(boolean mailingAddressSameAsPhysical) {
        Faker faker = faker();
        return CreateOrganizationRequest.builder()
                .name(uniqueName(faker.company().name()))
                .category(faker.company().industry())
                .numberOfEmployees(faker.number().numberBetween(1, 5000))
                .websiteUrl("https://" + faker.internet().domainName())
                .notes(faker.lorem().sentence())
                .monthlyRevenue(new BigDecimal(faker.number().numberBetween(1_000, 500_000)))
                .contractStartDate(LocalDate.now())
                .contractEndDate(LocalDate.now().plusYears(1))
                .contactInformation(contactInformation(mailingAddressSameAsPhysical))
                .build();
    }

    /** A full-field update, so a round-trip assertion covers every writable attribute. */
    public static UpdateOrganizationRequest updateOrganizationRequest(boolean mailingAddressSameAsPhysical) {
        Faker faker = faker();
        return UpdateOrganizationRequest.builder()
                .name(uniqueName(faker.company().name()))
                .category(faker.company().industry())
                .numberOfEmployees(faker.number().numberBetween(1, 5000))
                .websiteUrl("https://" + faker.internet().domainName())
                .notes(faker.lorem().sentence())
                .monthlyRevenue(new BigDecimal(faker.number().numberBetween(1_000, 500_000)))
                .contractStartDate(LocalDate.now().plusMonths(1))
                .contractEndDate(LocalDate.now().plusMonths(7))
                .contactInformation(contactInformation(mailingAddressSameAsPhysical))
                .build();
    }

    private static ContactInformationDto contactInformation(boolean mailingAddressSameAsPhysical) {
        ContactInformationDto.ContactInformationDtoBuilder builder = ContactInformationDto.builder()
                .physicalAddress(address())
                .mailingAddressSameAsPhysical(mailingAddressSameAsPhysical)
                .contacts(List.of(contactPerson()));
        if (!mailingAddressSameAsPhysical) {
            builder.mailingAddress(address());
        }
        return builder.build();
    }

    private static AddressDto address() {
        Faker faker = faker();
        return AddressDto.builder()
                .street1(faker.address().streetAddress())
                .street2(faker.address().secondaryAddress())
                .city(faker.address().city())
                .state(faker.address().state())
                .postalCode(faker.address().postcode())
                .country(faker.address().country())
                .build();
    }

    private static ContactPersonDto contactPerson() {
        Faker faker = faker();
        return ContactPersonDto.builder()
                .contactName(faker.name().fullName())
                .title(faker.job().title())
                .email(faker.internet().emailAddress())
                .phone(faker.phoneNumber().phoneNumber())
                .build();
    }
}
