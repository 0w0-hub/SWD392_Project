package com.swd392.onlineshopping.broker.web;

import static org.assertj.core.api.Assertions.assertThat;

import com.swd392.onlineshopping.broker.registry.ServiceRegistration;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

/**
 * Kiem tra dung hop dong REST ma ca 4 service trong nhom se goi.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class RegistryApiTest {

    @Autowired
    private TestRestTemplate rest;

    private ServiceRegistration registration(String serviceId, String name) {
        return new ServiceRegistration(serviceId, name, "1.0", "localhost", 8081,
                "http://localhost:8081", "http://localhost:8081/actuator/health",
                List.of("placeHold", "captureHold"));
    }

    private List<Map<String, Object>> lookup(String serviceName) {
        return rest.exchange("/registry/services/" + serviceName, HttpMethod.GET, null,
                new ParameterizedTypeReference<List<Map<String, Object>>>() {
                }).getBody();
    }

    @Test
    void vongDoiDayDu_dangKy_heartbeat_traCuu_huyDangKy() {
        // 1. Service tu dang ky khi khoi dong
        ResponseEntity<Map> created = rest.postForEntity("/registry/services",
                registration("api-1", "CustomerAccountService"), Map.class);
        assertThat(created.getStatusCode()).isEqualTo(HttpStatus.CREATED);

        // 2. Client tra cuu duoc dia chi
        var found = lookup("CustomerAccountService");
        assertThat(found).hasSize(1);
        assertThat(found.get(0).get("baseUrl")).isEqualTo("http://localhost:8081");
        assertThat(found.get(0).get("status")).isEqualTo("UP");

        // 3. Service gui heartbeat
        ResponseEntity<Void> beat = rest.exchange("/registry/services/api-1/heartbeat",
                HttpMethod.PUT, HttpEntity.EMPTY, Void.class);
        assertThat(beat.getStatusCode()).isEqualTo(HttpStatus.OK);

        // 4. Service tat -> huy dang ky
        ResponseEntity<Void> gone = rest.exchange("/registry/services/api-1",
                HttpMethod.DELETE, null, Void.class);
        assertThat(gone.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);

        assertThat(lookup("CustomerAccountService")).isEmpty();
    }

    @Test
    void heartbeatCuaServiceLa_thiTraVe404_deServiceTuDangKyLai() {
        ResponseEntity<Void> response = rest.exchange("/registry/services/khong-quen-biet/heartbeat",
                HttpMethod.PUT, HttpEntity.EMPTY, Void.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void traCuuServiceChuaChay_thiTraVeMangRong_khongPhai404() {
        ResponseEntity<List> response = rest.getForEntity("/registry/services/InventoryService", List.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isEmpty();
    }

    @Test
    void banDangKyThieuTruongBatBuoc_thiTraVe400() {
        var thieuServiceName = new ServiceRegistration("api-2", "  ", "1.0", "localhost", 8081,
                "http://localhost:8081", null, List.of());

        ResponseEntity<Map> response = rest.postForEntity("/registry/services", thieuServiceName, Map.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody().get("error")).isEqualTo("INVALID_REGISTRATION");
    }
}