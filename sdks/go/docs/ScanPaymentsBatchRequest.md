# ScanPaymentsBatchRequest

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**KeyPairs** | [**[]ScanPaymentsBatchRequestKeyPairsInner**](ScanPaymentsBatchRequestKeyPairsInner.md) |  | 
**FromSlot** | Pointer to **int32** |  | [optional] 
**ToSlot** | Pointer to **int32** |  | [optional] 
**Limit** | Pointer to **int32** |  | [optional] [default to 100]

## Methods

### NewScanPaymentsBatchRequest

`func NewScanPaymentsBatchRequest(keyPairs []ScanPaymentsBatchRequestKeyPairsInner, ) *ScanPaymentsBatchRequest`

NewScanPaymentsBatchRequest instantiates a new ScanPaymentsBatchRequest object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewScanPaymentsBatchRequestWithDefaults

`func NewScanPaymentsBatchRequestWithDefaults() *ScanPaymentsBatchRequest`

NewScanPaymentsBatchRequestWithDefaults instantiates a new ScanPaymentsBatchRequest object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetKeyPairs

`func (o *ScanPaymentsBatchRequest) GetKeyPairs() []ScanPaymentsBatchRequestKeyPairsInner`

GetKeyPairs returns the KeyPairs field if non-nil, zero value otherwise.

### GetKeyPairsOk

`func (o *ScanPaymentsBatchRequest) GetKeyPairsOk() (*[]ScanPaymentsBatchRequestKeyPairsInner, bool)`

GetKeyPairsOk returns a tuple with the KeyPairs field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetKeyPairs

`func (o *ScanPaymentsBatchRequest) SetKeyPairs(v []ScanPaymentsBatchRequestKeyPairsInner)`

SetKeyPairs sets KeyPairs field to given value.


### GetFromSlot

`func (o *ScanPaymentsBatchRequest) GetFromSlot() int32`

GetFromSlot returns the FromSlot field if non-nil, zero value otherwise.

### GetFromSlotOk

`func (o *ScanPaymentsBatchRequest) GetFromSlotOk() (*int32, bool)`

GetFromSlotOk returns a tuple with the FromSlot field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetFromSlot

`func (o *ScanPaymentsBatchRequest) SetFromSlot(v int32)`

SetFromSlot sets FromSlot field to given value.

### HasFromSlot

`func (o *ScanPaymentsBatchRequest) HasFromSlot() bool`

HasFromSlot returns a boolean if a field has been set.

### GetToSlot

`func (o *ScanPaymentsBatchRequest) GetToSlot() int32`

GetToSlot returns the ToSlot field if non-nil, zero value otherwise.

### GetToSlotOk

`func (o *ScanPaymentsBatchRequest) GetToSlotOk() (*int32, bool)`

GetToSlotOk returns a tuple with the ToSlot field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetToSlot

`func (o *ScanPaymentsBatchRequest) SetToSlot(v int32)`

SetToSlot sets ToSlot field to given value.

### HasToSlot

`func (o *ScanPaymentsBatchRequest) HasToSlot() bool`

HasToSlot returns a boolean if a field has been set.

### GetLimit

`func (o *ScanPaymentsBatchRequest) GetLimit() int32`

GetLimit returns the Limit field if non-nil, zero value otherwise.

### GetLimitOk

`func (o *ScanPaymentsBatchRequest) GetLimitOk() (*int32, bool)`

GetLimitOk returns a tuple with the Limit field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetLimit

`func (o *ScanPaymentsBatchRequest) SetLimit(v int32)`

SetLimit sets Limit field to given value.

### HasLimit

`func (o *ScanPaymentsBatchRequest) HasLimit() bool`

HasLimit returns a boolean if a field has been set.


[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


