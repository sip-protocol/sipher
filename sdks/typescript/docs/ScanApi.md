# ScanApi

All URIs are relative to *https://sipher.sip-protocol.org*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**scanAssets**](ScanApi.md#scanassetsoperation) | **POST** /v1/scan/assets | Scan stealth address assets via Helius DAS |
| [**scanPayments**](ScanApi.md#scanpaymentsoperation) | **POST** /v1/scan/payments | Scan for incoming shielded payments |
| [**scanPaymentsBatch**](ScanApi.md#scanpaymentsbatchoperation) | **POST** /v1/scan/payments/batch | Batch scan for payments across multiple key pairs |



## scanAssets

> ScanAssets200Response scanAssets(scanAssetsRequest)

Scan stealth address assets via Helius DAS

Query all assets (SPL tokens, NFTs, cNFTs) at a stealth address using Helius DAS getAssetsByOwner API. Falls back to standard getTokenAccountsByOwner if Helius is not configured.

### Example

```ts
import {
  Configuration,
  ScanApi,
} from '@sip-protocol/sipher-client';
import type { ScanAssetsOperationRequest } from '@sip-protocol/sipher-client';

async function example() {
  console.log("🚀 Testing @sip-protocol/sipher-client SDK...");
  const config = new Configuration({ 
    // To configure API key authorization: ApiKeyAuth
    apiKey: "YOUR API KEY",
  });
  const api = new ScanApi(config);

  const body = {
    // ScanAssetsRequest
    scanAssetsRequest: ...,
  } satisfies ScanAssetsOperationRequest;

  try {
    const data = await api.scanAssets(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **scanAssetsRequest** | [ScanAssetsRequest](ScanAssetsRequest.md) |  | |

### Return type

[**ScanAssets200Response**](ScanAssets200Response.md)

### Authorization

[ApiKeyAuth](../README.md#ApiKeyAuth)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Asset list |  -  |
| **400** | Invalid address |  -  |
| **503** | Helius DAS unavailable |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## scanPayments

> ScanPayments200Response scanPayments(scanPaymentsRequest)

Scan for incoming shielded payments

Scans Solana for SIP announcements matching the provided viewing key.

### Example

```ts
import {
  Configuration,
  ScanApi,
} from '@sip-protocol/sipher-client';
import type { ScanPaymentsOperationRequest } from '@sip-protocol/sipher-client';

async function example() {
  console.log("🚀 Testing @sip-protocol/sipher-client SDK...");
  const config = new Configuration({ 
    // To configure API key authorization: ApiKeyAuth
    apiKey: "YOUR API KEY",
  });
  const api = new ScanApi(config);

  const body = {
    // ScanPaymentsRequest
    scanPaymentsRequest: ...,
  } satisfies ScanPaymentsOperationRequest;

  try {
    const data = await api.scanPayments(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **scanPaymentsRequest** | [ScanPaymentsRequest](ScanPaymentsRequest.md) |  | |

### Return type

[**ScanPayments200Response**](ScanPayments200Response.md)

### Authorization

[ApiKeyAuth](../README.md#ApiKeyAuth)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Scan results |  -  |
| **400** | Validation error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## scanPaymentsBatch

> ScanPaymentsBatch200Response scanPaymentsBatch(scanPaymentsBatchRequest)

Batch scan for payments across multiple key pairs

Scan for incoming shielded payments across multiple viewing key pairs. Max 100 key pairs per request.

### Example

```ts
import {
  Configuration,
  ScanApi,
} from '@sip-protocol/sipher-client';
import type { ScanPaymentsBatchOperationRequest } from '@sip-protocol/sipher-client';

async function example() {
  console.log("🚀 Testing @sip-protocol/sipher-client SDK...");
  const config = new Configuration({ 
    // To configure API key authorization: ApiKeyAuth
    apiKey: "YOUR API KEY",
  });
  const api = new ScanApi(config);

  const body = {
    // ScanPaymentsBatchRequest
    scanPaymentsBatchRequest: ...,
  } satisfies ScanPaymentsBatchOperationRequest;

  try {
    const data = await api.scanPaymentsBatch(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **scanPaymentsBatchRequest** | [ScanPaymentsBatchRequest](ScanPaymentsBatchRequest.md) |  | |

### Return type

[**ScanPaymentsBatch200Response**](ScanPaymentsBatch200Response.md)

### Authorization

[ApiKeyAuth](../README.md#ApiKeyAuth)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Batch scan results |  -  |
| **400** | Validation error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

