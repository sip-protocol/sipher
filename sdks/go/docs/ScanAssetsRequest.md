# ScanAssetsRequest

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Address** | **string** | Base58-encoded Solana public key | 
**DisplayOptions** | Pointer to [**ScanAssetsRequestDisplayOptions**](ScanAssetsRequestDisplayOptions.md) |  | [optional] 
**Page** | Pointer to **int32** |  | [optional] [default to 1]
**Limit** | Pointer to **int32** |  | [optional] [default to 100]

## Methods

### NewScanAssetsRequest

`func NewScanAssetsRequest(address string, ) *ScanAssetsRequest`

NewScanAssetsRequest instantiates a new ScanAssetsRequest object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewScanAssetsRequestWithDefaults

`func NewScanAssetsRequestWithDefaults() *ScanAssetsRequest`

NewScanAssetsRequestWithDefaults instantiates a new ScanAssetsRequest object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetAddress

`func (o *ScanAssetsRequest) GetAddress() string`

GetAddress returns the Address field if non-nil, zero value otherwise.

### GetAddressOk

`func (o *ScanAssetsRequest) GetAddressOk() (*string, bool)`

GetAddressOk returns a tuple with the Address field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetAddress

`func (o *ScanAssetsRequest) SetAddress(v string)`

SetAddress sets Address field to given value.


### GetDisplayOptions

`func (o *ScanAssetsRequest) GetDisplayOptions() ScanAssetsRequestDisplayOptions`

GetDisplayOptions returns the DisplayOptions field if non-nil, zero value otherwise.

### GetDisplayOptionsOk

`func (o *ScanAssetsRequest) GetDisplayOptionsOk() (*ScanAssetsRequestDisplayOptions, bool)`

GetDisplayOptionsOk returns a tuple with the DisplayOptions field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetDisplayOptions

`func (o *ScanAssetsRequest) SetDisplayOptions(v ScanAssetsRequestDisplayOptions)`

SetDisplayOptions sets DisplayOptions field to given value.

### HasDisplayOptions

`func (o *ScanAssetsRequest) HasDisplayOptions() bool`

HasDisplayOptions returns a boolean if a field has been set.

### GetPage

`func (o *ScanAssetsRequest) GetPage() int32`

GetPage returns the Page field if non-nil, zero value otherwise.

### GetPageOk

`func (o *ScanAssetsRequest) GetPageOk() (*int32, bool)`

GetPageOk returns a tuple with the Page field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetPage

`func (o *ScanAssetsRequest) SetPage(v int32)`

SetPage sets Page field to given value.

### HasPage

`func (o *ScanAssetsRequest) HasPage() bool`

HasPage returns a boolean if a field has been set.

### GetLimit

`func (o *ScanAssetsRequest) GetLimit() int32`

GetLimit returns the Limit field if non-nil, zero value otherwise.

### GetLimitOk

`func (o *ScanAssetsRequest) GetLimitOk() (*int32, bool)`

GetLimitOk returns a tuple with the Limit field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetLimit

`func (o *ScanAssetsRequest) SetLimit(v int32)`

SetLimit sets Limit field to given value.

### HasLimit

`func (o *ScanAssetsRequest) HasLimit() bool`

HasLimit returns a boolean if a field has been set.


[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


