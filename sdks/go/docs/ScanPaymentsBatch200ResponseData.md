# ScanPaymentsBatch200ResponseData

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Results** | Pointer to [**[]ScanPaymentsBatch200ResponseDataResultsInner**](ScanPaymentsBatch200ResponseDataResultsInner.md) |  | [optional] 
**Summary** | Pointer to [**ScanPaymentsBatch200ResponseDataSummary**](ScanPaymentsBatch200ResponseDataSummary.md) |  | [optional] 

## Methods

### NewScanPaymentsBatch200ResponseData

`func NewScanPaymentsBatch200ResponseData() *ScanPaymentsBatch200ResponseData`

NewScanPaymentsBatch200ResponseData instantiates a new ScanPaymentsBatch200ResponseData object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewScanPaymentsBatch200ResponseDataWithDefaults

`func NewScanPaymentsBatch200ResponseDataWithDefaults() *ScanPaymentsBatch200ResponseData`

NewScanPaymentsBatch200ResponseDataWithDefaults instantiates a new ScanPaymentsBatch200ResponseData object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetResults

`func (o *ScanPaymentsBatch200ResponseData) GetResults() []ScanPaymentsBatch200ResponseDataResultsInner`

GetResults returns the Results field if non-nil, zero value otherwise.

### GetResultsOk

`func (o *ScanPaymentsBatch200ResponseData) GetResultsOk() (*[]ScanPaymentsBatch200ResponseDataResultsInner, bool)`

GetResultsOk returns a tuple with the Results field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetResults

`func (o *ScanPaymentsBatch200ResponseData) SetResults(v []ScanPaymentsBatch200ResponseDataResultsInner)`

SetResults sets Results field to given value.

### HasResults

`func (o *ScanPaymentsBatch200ResponseData) HasResults() bool`

HasResults returns a boolean if a field has been set.

### GetSummary

`func (o *ScanPaymentsBatch200ResponseData) GetSummary() ScanPaymentsBatch200ResponseDataSummary`

GetSummary returns the Summary field if non-nil, zero value otherwise.

### GetSummaryOk

`func (o *ScanPaymentsBatch200ResponseData) GetSummaryOk() (*ScanPaymentsBatch200ResponseDataSummary, bool)`

GetSummaryOk returns a tuple with the Summary field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetSummary

`func (o *ScanPaymentsBatch200ResponseData) SetSummary(v ScanPaymentsBatch200ResponseDataSummary)`

SetSummary sets Summary field to given value.

### HasSummary

`func (o *ScanPaymentsBatch200ResponseData) HasSummary() bool`

HasSummary returns a boolean if a field has been set.


[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


