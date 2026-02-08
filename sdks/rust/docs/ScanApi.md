# \ScanApi

All URIs are relative to *https://sipher.sip-protocol.org*

Method | HTTP request | Description
------------- | ------------- | -------------
[**scan_assets**](ScanApi.md#scan_assets) | **POST** /v1/scan/assets | Scan stealth address assets via Helius DAS
[**scan_payments**](ScanApi.md#scan_payments) | **POST** /v1/scan/payments | Scan for incoming shielded payments
[**scan_payments_batch**](ScanApi.md#scan_payments_batch) | **POST** /v1/scan/payments/batch | Batch scan for payments across multiple key pairs



## scan_assets

> models::ScanAssets200Response scan_assets(scan_assets_request)
Scan stealth address assets via Helius DAS

Query all assets (SPL tokens, NFTs, cNFTs) at a stealth address using Helius DAS getAssetsByOwner API. Falls back to standard getTokenAccountsByOwner if Helius is not configured.

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**scan_assets_request** | [**ScanAssetsRequest**](ScanAssetsRequest.md) |  | [required] |

### Return type

[**models::ScanAssets200Response**](scanAssets_200_response.md)

### Authorization

[ApiKeyAuth](../README.md#ApiKeyAuth)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## scan_payments

> models::ScanPayments200Response scan_payments(scan_payments_request)
Scan for incoming shielded payments

Scans Solana for SIP announcements matching the provided viewing key.

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**scan_payments_request** | [**ScanPaymentsRequest**](ScanPaymentsRequest.md) |  | [required] |

### Return type

[**models::ScanPayments200Response**](scanPayments_200_response.md)

### Authorization

[ApiKeyAuth](../README.md#ApiKeyAuth)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)


## scan_payments_batch

> models::ScanPaymentsBatch200Response scan_payments_batch(scan_payments_batch_request)
Batch scan for payments across multiple key pairs

Scan for incoming shielded payments across multiple viewing key pairs. Max 100 key pairs per request.

### Parameters


Name | Type | Description  | Required | Notes
------------- | ------------- | ------------- | ------------- | -------------
**scan_payments_batch_request** | [**ScanPaymentsBatchRequest**](ScanPaymentsBatchRequest.md) |  | [required] |

### Return type

[**models::ScanPaymentsBatch200Response**](scanPaymentsBatch_200_response.md)

### Authorization

[ApiKeyAuth](../README.md#ApiKeyAuth)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

