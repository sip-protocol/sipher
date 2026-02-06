# PrivacyScore200ResponseData

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Address** | Pointer to **string** |  | [optional] 
**Score** | Pointer to **int32** |  | [optional] 
**Grade** | Pointer to **string** |  | [optional] 
**TransactionsAnalyzed** | Pointer to **int32** |  | [optional] 
**Factors** | Pointer to [**PrivacyScore200ResponseDataFactors**](PrivacyScore200ResponseDataFactors.md) |  | [optional] 
**Recommendations** | Pointer to **[]string** |  | [optional] 

## Methods

### NewPrivacyScore200ResponseData

`func NewPrivacyScore200ResponseData() *PrivacyScore200ResponseData`

NewPrivacyScore200ResponseData instantiates a new PrivacyScore200ResponseData object
This constructor will assign default values to properties that have it defined,
and makes sure properties required by API are set, but the set of arguments
will change when the set of required properties is changed

### NewPrivacyScore200ResponseDataWithDefaults

`func NewPrivacyScore200ResponseDataWithDefaults() *PrivacyScore200ResponseData`

NewPrivacyScore200ResponseDataWithDefaults instantiates a new PrivacyScore200ResponseData object
This constructor will only assign default values to properties that have it defined,
but it doesn't guarantee that properties required by API are set

### GetAddress

`func (o *PrivacyScore200ResponseData) GetAddress() string`

GetAddress returns the Address field if non-nil, zero value otherwise.

### GetAddressOk

`func (o *PrivacyScore200ResponseData) GetAddressOk() (*string, bool)`

GetAddressOk returns a tuple with the Address field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetAddress

`func (o *PrivacyScore200ResponseData) SetAddress(v string)`

SetAddress sets Address field to given value.

### HasAddress

`func (o *PrivacyScore200ResponseData) HasAddress() bool`

HasAddress returns a boolean if a field has been set.

### GetScore

`func (o *PrivacyScore200ResponseData) GetScore() int32`

GetScore returns the Score field if non-nil, zero value otherwise.

### GetScoreOk

`func (o *PrivacyScore200ResponseData) GetScoreOk() (*int32, bool)`

GetScoreOk returns a tuple with the Score field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetScore

`func (o *PrivacyScore200ResponseData) SetScore(v int32)`

SetScore sets Score field to given value.

### HasScore

`func (o *PrivacyScore200ResponseData) HasScore() bool`

HasScore returns a boolean if a field has been set.

### GetGrade

`func (o *PrivacyScore200ResponseData) GetGrade() string`

GetGrade returns the Grade field if non-nil, zero value otherwise.

### GetGradeOk

`func (o *PrivacyScore200ResponseData) GetGradeOk() (*string, bool)`

GetGradeOk returns a tuple with the Grade field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetGrade

`func (o *PrivacyScore200ResponseData) SetGrade(v string)`

SetGrade sets Grade field to given value.

### HasGrade

`func (o *PrivacyScore200ResponseData) HasGrade() bool`

HasGrade returns a boolean if a field has been set.

### GetTransactionsAnalyzed

`func (o *PrivacyScore200ResponseData) GetTransactionsAnalyzed() int32`

GetTransactionsAnalyzed returns the TransactionsAnalyzed field if non-nil, zero value otherwise.

### GetTransactionsAnalyzedOk

`func (o *PrivacyScore200ResponseData) GetTransactionsAnalyzedOk() (*int32, bool)`

GetTransactionsAnalyzedOk returns a tuple with the TransactionsAnalyzed field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetTransactionsAnalyzed

`func (o *PrivacyScore200ResponseData) SetTransactionsAnalyzed(v int32)`

SetTransactionsAnalyzed sets TransactionsAnalyzed field to given value.

### HasTransactionsAnalyzed

`func (o *PrivacyScore200ResponseData) HasTransactionsAnalyzed() bool`

HasTransactionsAnalyzed returns a boolean if a field has been set.

### GetFactors

`func (o *PrivacyScore200ResponseData) GetFactors() PrivacyScore200ResponseDataFactors`

GetFactors returns the Factors field if non-nil, zero value otherwise.

### GetFactorsOk

`func (o *PrivacyScore200ResponseData) GetFactorsOk() (*PrivacyScore200ResponseDataFactors, bool)`

GetFactorsOk returns a tuple with the Factors field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetFactors

`func (o *PrivacyScore200ResponseData) SetFactors(v PrivacyScore200ResponseDataFactors)`

SetFactors sets Factors field to given value.

### HasFactors

`func (o *PrivacyScore200ResponseData) HasFactors() bool`

HasFactors returns a boolean if a field has been set.

### GetRecommendations

`func (o *PrivacyScore200ResponseData) GetRecommendations() []string`

GetRecommendations returns the Recommendations field if non-nil, zero value otherwise.

### GetRecommendationsOk

`func (o *PrivacyScore200ResponseData) GetRecommendationsOk() (*[]string, bool)`

GetRecommendationsOk returns a tuple with the Recommendations field if it's non-nil, zero value otherwise
and a boolean to check if the value has been set.

### SetRecommendations

`func (o *PrivacyScore200ResponseData) SetRecommendations(v []string)`

SetRecommendations sets Recommendations field to given value.

### HasRecommendations

`func (o *PrivacyScore200ResponseData) HasRecommendations() bool`

HasRecommendations returns a boolean if a field has been set.


[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


