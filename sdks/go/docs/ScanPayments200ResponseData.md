# ScanPayments200ResponseData

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Payments** | Pointer to [**[]ScanPayments200ResponseDataPaymentsInner**](ScanPayments200ResponseDataPaymentsInner.md) |  | [optional] 
**Scanned** | Pointer to **int32** |  | [optional] 

## Methods

### NewScanPayments200ResponseData

`func NewScanPayments200ResponseData() *ScanPayments200ResponseData`

NewScanPayments200ResponseData instantiates a new ScanPayments200ResponseData object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewScanPayments200ResponseDataWithDefaults

`func NewScanPayments200ResponseDataWithDefaults() *ScanPayments200ResponseData`

NewScanPayments200ResponseDataWithDefaults instantiates a new ScanPayments200ResponseData object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetPayments

`func (o *ScanPayments200ResponseData) GetPayments() []ScanPayments200ResponseDataPaymentsInner`

GetPayments returns the Payments field if non-nil, zero value otherwise.

### GetPaymentsOk

`func (o *ScanPayments200ResponseData) GetPaymentsOk() (*[]ScanPayments200ResponseDataPaymentsInner, bool)`

GetPaymentsOk returns a tuple with the Payments field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetPayments

`func (o *ScanPayments200ResponseData) SetPayments(v []ScanPayments200ResponseDataPaymentsInner)`

SetPayments sets Payments field to given value.

### HasPayments

`func (o *ScanPayments200ResponseData) HasPayments() bool`

HasPayments returns a boolean if a field has been set.

### GetScanned

`func (o *ScanPayments200ResponseData) GetScanned() int32`

GetScanned returns the Scanned field if non-nil, zero value otherwise.

### GetScannedOk

`func (o *ScanPayments200ResponseData) GetScannedOk() (*int32, bool)`

GetScannedOk returns a tuple with the Scanned field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetScanned

`func (o *ScanPayments200ResponseData) SetScanned(v int32)`

SetScanned sets Scanned field to given value.

### HasScanned

`func (o *ScanPayments200ResponseData) HasScanned() bool`

HasScanned returns a boolean if a field has been set.


[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


