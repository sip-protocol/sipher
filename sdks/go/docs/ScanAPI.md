# \ScanAPI

All URIs are relative to *https://sipher.sip-protocol.org*

Method | HTTP request | Description
------------- | ------------- | -------------
[**ScanPayments**](ScanAPI.md#ScanPayments) | **Post** /v1/scan/payments | Scan for incoming shielded payments
[**ScanPaymentsBatch**](ScanAPI.md#ScanPaymentsBatch) | **Post** /v1/scan/payments/batch | Batch scan for payments across multiple key pairs



## ScanPayments

> ScanPayments200Response ScanPayments(ctx).ScanPaymentsRequest(scanPaymentsRequest).Execute()

Scan for incoming shielded payments



### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID/sipher"
)

func main() {
	scanPaymentsRequest := *openapiclient.NewScanPaymentsRequest("0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef", "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef") // ScanPaymentsRequest | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ScanAPI.ScanPayments(context.Background()).ScanPaymentsRequest(scanPaymentsRequest).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ScanAPI.ScanPayments``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ScanPayments`: ScanPayments200Response
	fmt.Fprintf(os.Stdout, "Response from `ScanAPI.ScanPayments`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiScanPaymentsRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **scanPaymentsRequest** | [**ScanPaymentsRequest**](ScanPaymentsRequest.md) |  | 

### Return type

[**ScanPayments200Response**](ScanPayments200Response.md)

### Authorization

[ApiKeyAuth](../README.md#ApiKeyAuth)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)


## ScanPaymentsBatch

> ScanPaymentsBatch200Response ScanPaymentsBatch(ctx).ScanPaymentsBatchRequest(scanPaymentsBatchRequest).Execute()

Batch scan for payments across multiple key pairs



### Example

```go
package main

import (
	"context"
	"fmt"
	"os"
	openapiclient "github.com/GIT_USER_ID/GIT_REPO_ID/sipher"
)

func main() {
	scanPaymentsBatchRequest := *openapiclient.NewScanPaymentsBatchRequest([]openapiclient.ScanPaymentsBatchRequestKeyPairsInner{*openapiclient.NewScanPaymentsBatchRequestKeyPairsInner("0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef", "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef")}) // ScanPaymentsBatchRequest | 

	configuration := openapiclient.NewConfiguration()
	apiClient := openapiclient.NewAPIClient(configuration)
	resp, r, err := apiClient.ScanAPI.ScanPaymentsBatch(context.Background()).ScanPaymentsBatchRequest(scanPaymentsBatchRequest).Execute()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error when calling `ScanAPI.ScanPaymentsBatch``: %v\n", err)
		fmt.Fprintf(os.Stderr, "Full HTTP response: %v\n", r)
	}
	// response from `ScanPaymentsBatch`: ScanPaymentsBatch200Response
	fmt.Fprintf(os.Stdout, "Response from `ScanAPI.ScanPaymentsBatch`: %v\n", resp)
}
```

### Path Parameters



### Other Parameters

Other parameters are passed through a pointer to a apiScanPaymentsBatchRequest struct via the builder pattern


Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **scanPaymentsBatchRequest** | [**ScanPaymentsBatchRequest**](ScanPaymentsBatchRequest.md) |  | 

### Return type

[**ScanPaymentsBatch200Response**](ScanPaymentsBatch200Response.md)

### Authorization

[ApiKeyAuth](../README.md#ApiKeyAuth)

### HTTP request headers

- **Content-Type**: application/json
- **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints)
[[Back to Model list]](../README.md#documentation-for-models)
[[Back to README]](../README.md)

